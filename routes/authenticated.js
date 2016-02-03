module.exports = function(apiRoutes, conn, socketUtils, utils){

	var globalDescribe;
	var updated = {};

	var onError = function(err, response){
		response.status(400);
		console.log(err);
		response.send(err);
	}

	var querySearchResults = function(query, limit, offset, geo, response){
		conn.search(query, function(err, data){
			if(err)
				onError(err, response);
			else if(!data || data.length == 0){
				response.status(204).send();
			}
			else{
				var variantList = new Array();
				var productList = new Array();
				for(var i = 0; i<data.length; i++){
					if(data[i].attributes.type == 'Variant__c')
						variantList.push("'" + data[i].Id + "'");
					else if(data[i].attributes.type == 'Dorrbell_Product__c')
						productList.push("'" + data[i].Id + "'");
				}
				var pClause = "Dorrbell_Product__c IN (" + productList.join(",") + ")";
				var vClause = "Id IN (" + variantList.join(",") + ")";
				var where;
				if(variantList.length > 0 && productList.length > 0)
					where = vClause + " OR " + pClause;
				else if(variantList.length > 0 && productList.length == 0)
					where = vClause;
				else if(productList.length > 0 && variantList.length == 0)
					where = pClause;
				else
					response.status(204).send();



				if(where){
					var query = getItemSearchQuery(where, geo, limit, offset);
					conn.query(query, function(err, queryData){
						if(err)
							onError(err, response);
						response.json(queryData);
					});
				}
			}
		});
	}

	var getItemSearchQuery = function(where, geo, limit, offset){
		var g = (geo) ? geo : '';
		return  "SELECT Id, \
						Variant_SKU__c, \
						Name, \
						Variant_Title__c, \
						Variant_Price__c, \
						Image_URL__c, \
						Barcode__c, \
						Store_Name__c, \
						Store_Id__c, \
						Dorrbell_Product__r.Name, \
						Compare_At_Price__c \
					FROM Variant__c \
				WHERE " + where + " " +
				g +
				" LIMIT " + limit + " OFFSET " + offset;
	}

	var setOrderStatus = function(orderId, orderStatus, deliveryStatus, itemStatus, orderRecordTypeId, deliveryRecordTypeId, itemRecordTypeId, response){
		var setDeliveryStatus;
		var setItemStatus;
		var orderStatus = new Promise(function(resolve, reject){
			var data = {
				Id : orderId,
				Status__c : orderStatus
			};
			if(orderRecordTypeId)
				data.RecordTypeId = orderRecordTypeId;

			conn.sobject("Dorrbell_Order__c").update(data, function(error, result){
				if(error)
					reject(error);
				else
					resolve(result);
			});
		}).then(function(updateOrderStatus){
			if(deliveryStatus && deliveryStatus != null){
				setDeliveryStatus = new Promise(function(deliveryResolve, deliveryReject){
					var getDeliveries = new Promise(function(resolve, reject){
						conn.query("SELECT Id FROM Delivery__c WHERE Dorrbell_Order__c = '" + orderId + "'", function(error, result){
							if(error || !result.records)
								reject(error);
							else
								resolve(result);
						});
					});

					getDeliveries.then(function(data){
						var idArray = new Array();
						for(var i =0; i<data.records.length; i++){
							var record = {
								"Id" : data.records[i].Id
								, "Status__c" : deliveryStatus
							};
							if(deliveryRecordTypeId)
								record.RecordTypeId = deliveryRecordTypeId;

							idArray.push(record);
						}
						conn.sobject("Delivery__c").update(idArray, function(error, result){
							if(error){
								deliveryReject(error);
							}
							else
								deliveryResolve(result);
						})
					}, deliveryReject);
				})
			}


			if(itemStatus && itemStatus != null){
				setItemStatus = new Promise(function(itemResolve, itemReject){
					var getItems = new Promise(function(resolve, reject){
						conn.query("SELECT Id FROM Delivery_Item__c WHERE Status__c = 'Checked Out' AND Related_Delivery__r.Dorrbell_Order__c = '" + orderId + "'", function(error, result){
							if(error || !result.records)
								reject(error);
							else
								resolve(result);
						});
					});

					getItems.then(function(data){
						var itemIdArray = new Array();
						for(var i = 0; i<data.records.length; i++){
							var record = {
								"Id" : data.records[i].Id
								, "Status__c" : itemStatus
							};
							if(itemRecordTypeId)
								record.RecordTypeId = itemRecordTypeId;

							itemIdArray.push(record);
						}
						conn.sobject("Delivery_Item__c").update(itemIdArray, function(error, result){
							if(error){
								itemReject(error);
							}
							else
								itemResolve(result);
						})
					}, itemReject);
				});

			}
		});





		var deffereds = new Array();
		deffereds.push(orderStatus);
		if(deliveryStatus && deliveryStatus != null)
			deffereds.push(setDeliveryStatus);
		if(itemStatus && itemStatus != null)
			deffereds.push(setItemStatus);

		Promise.all(deffereds).then(function(results){
			response.status(200).send("Ok");
		}, function(errors){
			onError(errors, response);
		});
	}



	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.get('/searchAllItems/:searchString/:latitude/:longitude/:limit/:offset', function(request, response){
		var text = request.params.searchString;
		var limit = request.params.limit;
		var offset = request.params.offset;
		var geo = "GEOLOCATION(" + request.params.latitude + "," + request.params.longitude + ")";
		var order = "ORDER BY DISTANCE(Dorrbell_Product__r.Store__r.Coordinates__c, " + geo + ", 'mi')";
		querySearchResults("FIND {*" + text + "*} IN ALL FIELDS RETURNING Variant__c(Id WHERE Barcode__c != null), Dorrbell_Product__c(Id)", limit, offset, order, response);
	});

	apiRoutes.get('/searchStoreItems/:store/:searchString/:limit/:offset', function(request, response){
		var store = request.params.store;
		var text = request.params.searchString;
		var limit = request.params.limit;
		var offset = request.params.offset;
		var order = "ORDER BY Name DESC";
		if(text && text.trim().length > 1 && text != 'undefined')
			querySearchResults("FIND {*" + text + "*} IN ALL FIELDS RETURNING Variant__c(Id WHERE Store_Id__c = '" + store + "' AND Barcode__c != null), Dorrbell_Product__c(Id WHERE Store__c = '" + store + "')", limit, offset, order, response);
		else {
			if(store && store.length > 15)
				store = store.substring(0, 15);

			var query = getItemSearchQuery("Store_Id__c = '" + store + "'", null, limit, offset);
			console.log(query);
			conn.query(query, function(err, queryData){
				if(err)
					onError(err, response);
				response.json(queryData);
			});
		}
	});

	apiRoutes.get('/describe/:sObject', function(request, response){
		conn.describe(request.params.sObject, function(err, meta){
			if(err)
				onError(err, response);

			response.json(meta);
		})
	});

	apiRoutes.get("/me", function(request, response){
		var contactId = request.decoded.Id;
		socketUtils.getUser(conn, contactId, function(data){
			response.status(200).send(data);
		}, function(err){
			onError(err, response);
		});
	});

	apiRoutes.post('/hasUpdated', function(request, response){
		var dirty = new Array();
		for(var key in updated){
			var recId = key.substring(0, 18);
			var recIdSmall = key.substring(0, 15);
			if(request.body[recId] && updated[key] != request.body[recId]){
				dirty.push(recId);
			}else if(request.body[recIdSmall] && updated[key] != request.body[recIdSmall]){
				dirty.push(recIdSmall);
			}
		}
		response.send(dirty);
	});

	apiRoutes.post('/query', function(request, response){
		var query = request.body.query.replace(new RegExp('SELECT ', 'g'), 'SELECT LastModifiedDate, ');
		conn.query(query, function(err, data){
			if(err)
				onError(err, response);

			//join rooms based on results
			console.log(request.body.socketId);
			if(request.body.socketId){
				socketUtils.joinRooms(data.records, request.body.socketId);
			}


			response.json(data.records);
		});


	});



	apiRoutes.post('/update/:sObject', function(request, response){
		conn.sobject(request.params.sObject).update([
			request.body
		], function(err, rets){
			if (err) { return console.error(err); }
			for (var i=0; i < rets.length; i++) {
			    if (!rets[i].success) {
			      	onError(err, response);
			    }
			}
			var retsJSON = JSON.stringify(rets);
			/*
			if(server)
				server.clients.forEach(function each(client){
					client.send(retsJSON);
				})
			*/

			response.status(200).send("Ok");
		})
	});

	apiRoutes.post('/startDelivery', function(request, response){
		setOrderStatus(request.body.orderId, "En Route to Customer", "En Route to Customer", null, null, null, null, response);
	});

	apiRoutes.post('/completeDelivery', function(request, response){
		setOrderStatus(request.body.orderId, "Delivered To Customer", "With Customer", null, null, null, null, response);
	});

	apiRoutes.post("/returnItem", function(request, response){
		conn.sobject("OrderItem").update([
			{Id : request.body.Id, Status__c : "Returning"}
		], function(err, rets){
			if(err)
				onError(err, repsonse);
			else
				response.status(200).send("Ok");
		})
	});

	apiRoutes.post("/startReturns", function(request, response){
		conn.query("SELECT Id FROM Delivery__c WHERE Dorrbell_Order__c = '" + request.body.Id + "' AND Number_of_Returns__c > 0", function(queryError, data){
			if(queryError)
				onError(queryError, response);
			else{
				var deliveries = new Array();
				for(var i in data.records){
					deliveries.push({Id : data.records[i].Id, Status__c : "Return Started"});
				}
				conn.sobject("Delivery__c").update(deliveries, function(err2, rets2){
					if(err2)
						onError(err2, response);
					else{
						setOrderStatus(request.body.Id, "Retrieved From Customer", null, null, null, null, null, response);
					}
				})
			}
		})
	});

	apiRoutes.post("/acceptDelivery", function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Status__c : "Accepted",
			Delivery_Shopping_Assistant__c : request.body.contactId
		}, function(err, result){
			if(err || !result.success)
				onError(err, response);
			else
				response.status(200).send("Ok");
		})
	})

	apiRoutes.post("/acceptReturn", function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Return_Shopping_Assistant__c : request.body.contactId
		}, function(err, result){
			if(err || !result.success)
				onError(err, response);
			else
				response.status(200).send("Ok");
		})
	})

	apiRoutes.post("/completeOrder", function(request, response){

		var recordTypes = new Promise(function(resolve, reject){
			conn.query("SELECT Id, sObjectType, DeveloperName FROM RecordType WHERE DeveloperName = 'Complete' AND (sObjectType = 'Dorrbell_Order__c' OR sObjectType = 'Delivery__c')", function(err, rets){
				if(err){
					reject(err);
				}
				else
					resolve(rets);
			});
		})

		var checkedOut = new Promise(function(resolve, reject){
			conn.query("SELECT Id FROM Delivery_Item__c WHERE Status__c = 'Checked Out' OR Status__c = 'Returning'", function(err, rets){
				if(err)
					reject(err);
				else
					resolve(rets);
			});
		})

		Promise.all([recordTypes, checkedOut]).then(function(results){
			if(checkedOut.records && checkedOut.records.length > 0)
				onError("Invalid Items", response);
			else{
				var orderRecordTypeId = null;
				var deliveryRecordTypeId = null;
				for(var i in results[0].records){
					if(results[0].records[i].SobjectType == 'Dorrbell_Order__c' && results[0].records[i].DeveloperName == 'Complete')
						orderRecordTypeId = results[0].records[i].Id;
					else if(results[0].records[i].SobjectType == 'Delivery__c' && results[0].records[i].DeveloperName == 'Complete')
						deliveryRecordTypeId = results[0].records[i].Id;
				}
				setOrderStatus(request.body.Id, "Completed", "Complete", "Purchased", orderRecordTypeId, deliveryRecordTypeId, null, response);
			}
		}, function(errors){
			onError(errors, response);
		});

	});

	apiRoutes.post("/checkInItem", function(request, response){
		conn.sobject("OrderItem").update([
			{Id : request.body.Id, Status__c : "Checked In"}
		], function(err, rets){
			if(err)
				onError(err, response);
			else{
				conn.query("SELECT Id FROM OrderItem WHERE Status__c = 'Returning' AND Order_Store__c = '" + request.body.Order_Store__c + "'", function(queryError, data){
					if(queryError)
						onError(queryError, response);
					else if(!data.records || data.records.length == 0){
						conn.sobject("Order_Store__c").update([
							{Id : request.body.Order_Store__c, Status__c : "Checked In"}
						], function(err2, rets2){
							if(err2)
								onError(err2, response);

							//Check if all items for all orders have been returned
							conn.query("SELECT Id FROM OrderItem WHERE OrderId = '" + request.body.OrderId + "' AND Status__c = 'Returning'", function(err3, data2){
								if(!data2.records || data2.records.length == 0)
									setOrderStatus(request.body.OrderId, "All Items Returned to All Retailers", null, null, null, null, null, response);
								else
									response.status(200).send("Ok");
							});
						});
					}
				});
			}
		})
	});

	apiRoutes.post('/createDeliveryItem', function(request, response){
		var deliveryId = request.body.deliveryId;
		var variantId = request.body.variantId;
		var contactId = request.body.contactId;

		conn.query("SELECT Id, \
							Barcode__c, \
							Variant_Price__c, \
							Variant_Title__c, \
							Image_URL__c, \
							Dorrbell_Product__r.Name, \
							Dorrbell_Product__r.Shopify_Product_Type__c, \
							Variant_SKU__c, \
							Store_Id__c \
						FROM Variant__c \
						WHERE Id = '" + variantId + "'",
		function(err, data){
			var variant = data.records[0];
			if(err || !variant){
				onError(err, response);
			}else{
				conn.sobject("Delivery_Item__c").create({
					"Barcode__c" : variant.Barcode__c,
					"Image_URL__c" : variant.Image_URL__c,
					"Online_Sale_Price__c" : variant.Variant_Price__c,
					"Options__c" : variant.Variant_Title__c,
					"Product_Name__c" : variant.Dorrbell_Product__r.Name,
					"Product_Type__c" : variant.Dorrbell_Product__r.Shopify_Product_Type__c,
					"Related_Store__c" : variant.Store_Id__c,
					"Related_Variant__c" : variant.Id,
					"Sku__c" : variant.Variant_SKU__c,
					"Related_Delivery__c" : deliveryId,
					"Item_Added_By__c" : contactId,
					"Item_Added_At__c" : new Date()
				}, function(error2, ret){
					if(error2 || !ret.success){
						onError(error2, response);
					}else{
						response.send(ret.Id);
					}
				});
			}
		});

	});


	/**************************
	 * My Account
	 *************************/
	 apiRoutes.post("/uploadProfilePhoto/:contactId", function(req,res){
		var contactId = req.params.contactId;
		var imageData = req.body.imageData;

		var imgUpload = new Promise(function(resolve, reject){
			conn.query("SELECT Id FROM Attachment WHERE ParentId = '" + contactId + "' AND Name = 'profile.jpg'", function(err, data){
				if(err)
					reject(err);
				else if(data.records && data.records.length > 0){
					resolve(data.records);
				}else{
					resolve();
				}
			});
		}).then(function(recordsToDelete){
			if(recordsToDelete){
				return new Promise(function(resolve, reject){
					var idArray = new Array();
					for(var i in recordsToDelete){
						idArray.push(recordsToDelete[i].Id);
					}
					conn.sobject("Attachment").del(idArray, function(err, rets){
						if(err)
							reject(err);
						else
							resolve(rets);
					});
				})	;
			}else{
				return null;
			}
		}, function(err){
			onError(err, response);
		}).then(function(){
			if(contactId && imageData && imageData.indexOf("base64,") != -1){
				var base64data = imageData.substring(imageData.indexOf("base64,") + 7);
				conn.sobject("Attachment").create({
					ParentId : contactId,
					Name: "profile.jpg",
					body: base64data,
					ContentType: "image/jpeg"
				}, function(err, ret){
					if(err)
						onError(err, res);
					else{
						socketUtils.getUser(conn, contactId, function(data){
							res.status(200).send(data);
						}, function(err){
							onError(err, res);
						});
					}
				})
			}else{
				onError("Invalid", res);
			}
		}, function(err){
			onError(err, response);
		})
	});

	apiRoutes.post("/changePassword", function(request, response){
		var passwordForm = request.body.password;
		var contactForm = request.body.contact;
		var getContact = new Promise(function(resolve, reject){
			conn.query("SELECT Id, Password__c FROM Contact WHERE Email = '" + contactForm.Email + "'", function(error, result){
				if(error)
					reject(error);
				else if(!result.records || result.records.length == 0)
					reject("Couldn't locate user record");
				else
					resolve(result);
			});
		}).then(function(data){
			return new Promise(function(resolve, reject){
				var contact = data.records[0];
				if(utils.encryptText(passwordForm.old) != contact.password__c){
					reject("Incorrect Password");
				}else if(passwordForm.newPassword != passwordForm.confirm){
					reject("Your passwords do not match");
				}else{
					conn.sobject("Contact").update({
						Id : contact.Id,
						Password__c : utils.encryptText(passwordForm.newPassword)
					}, function(error, response){
						if(error)
							reject(error);
						else
							resolve(response);
					});
				}
			});
		}, function(error){
			onError(error, response);
		}).then(function(data){
			response.status(200).send(data);
		}, function(error){
			onError(error, response);
		});

	})
}
