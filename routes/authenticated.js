module.exports = function(apiRoutes, conn, socketUtils, utils){

	var globalDescribe;
	var updated = {};

	var onError = function(err, response){
		utils.log(err);
		response.status(400);
		response.send(err);
	}

	var querySearchResults = function(records, limit, text, store, response){
		var query;
		var where = (store) ? " Pricebook2.IsStandard = true AND Product2.Store__c = '" + store + "' " : " Pricebook2.IsStandard = true ";
		if(records && records.length > 0){
			var idArray = "(";
			for(var i in records){
				idArray += "'" + records[i].Id + "',";
			}
			idArray = (idArray.indexOf(',') != -1) ? idArray.substring(0, idArray.lastIndexOf(',')) + ')' : idArray + ')';

			query = "SELECT Id, Product2Id, Product2.Name, Product2.Parent_Product__r.Name, Product2.Image__r.Image_Source__c, UnitPrice, Product2.Family FROM PricebookEntry WHERE" + where + "AND Product2Id IN " + idArray;
		}else if(text == 'undefined'){
			query = "SELECT Id, Product2Id, Product2.Name, Product2.Parent_Product__r.Name, Product2.Image__r.Image_Source__c, UnitPrice, Product2.Family FROM PricebookEntry WHERE" + where + "LIMIT " + limit;
		}
		if(query){
			conn.query(query, function(err, rets){
				if(err)
					onError(err, response);
				else
					response.json(rets.records);
			});
		}else{
			response.json([]);
		}

	}


	var setOrderStatus = function(orderId, orderStatus, deliveryStatus, itemStatus, response){
		var orderPromise = new Promise(function(resolve, reject){
			if(orderStatus){
				conn.sobject("Order").update({
					Id : orderId,
					Status__c : orderStatus
				}, function(err, ret){
						if(err)
							reject(err);
						else
							resolve(ret);
				});
			}else
				resolve();
		});

		var orderStorePromise = new Promise(function(resolve, reject){
			if(deliveryStatus){
				conn.query("SELECT Id FROM Order_Store__c WHERE Order__c = '" + orderId + "'", function(err, rets){
					if(err) reject(err);
					else{
						var idArray = new Array();
						for(var i in rets.records){
							idArray.push({
								Id : rets.records[i].Id,
								Status__c : deliveryStatus
							});
						}
						conn.sobject("Order_Store__c").update(idArray, function(updateError, updateResult){
							if(updateError) reject(updateError);
							else resolve(updateResult);
						});
					}
				});
			}else
				resolve();
		});

		var orderItemPromise = new Promise(function(resolve, reject){
			if(itemStatus){
				conn.query("SELECT Id FROM OrderItem WHERE OrderId = '" + orderId + "'", function(err, rets){
					if(err) reject(err);
					else{
						var idArray = new Array();
						for(var i in rets.records){
							idArray.push({
								Id : rets.records[i].Id,
								Status__c : itemStatus
							});
						}
						conn.sobject("OrderItem").update(idArray, function(updateError, updateResult){
							if(updateError) reject(updateError);
							else resolve(updateResult);
						});
					}
				});
			}else
				resolve();
		});
		Promise.all([orderPromise, orderStorePromise, orderItemPromise]).then(function(results){
			response.status(200).send("Ok");
		}, onError);
	}



	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.get('/searchAllItems/:searchString/:latitude/:longitude/:limit', function(request, response){
		var geo = "GEOLOCATION(" + request.params.latitude + "," + request.params.longitude + ")";
		var query ="FIND {*" + request.params.searchString + "*} IN ALL FIELDS \
								RETURNING Product2 \
									(Id WHERE Barcode__c != null \
											AND Parent_Product__c != null \
											ORDER BY DISTANCE(Store__r.Coordinates__c, " + geo + ", 'mi') \
									) \
									LIMIT " + request.params.limit;
		conn.search(query, function(err, records){
			querySearchResults(records, request.params.limit, request.params.searchString, null, response);
		});
	});

	apiRoutes.get('/searchStoreItems/:store/:searchString/:limit', function(request, response){
		var geo = "GEOLOCATION(" + request.params.latitude + "," + request.params.longitude + ")";
		var query ="FIND {*" + request.params.searchString + "*} IN ALL FIELDS \
								RETURNING Product2 \
									(Id WHERE Barcode__c != null \
											AND Parent_Product__c != null \
											AND Store__c = '" + request.params.store + "' \
									) \
									LIMIT " + request.params.limit;
		conn.search(query, function(err, records){
			querySearchResults(records, request.params.limit, request.params.searchString, request.params.store, response);
		});
	});

	apiRoutes.get('/describe/:sObject', function(request, response){
		conn.describe(request.params.sObject, function(err, meta){
			if(err)
				onError(err, response);

			response.json(meta.fields);
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
		setOrderStatus(request.body.orderId, "En Route to Customer", "En Route to Customer", null, response);
	});

	apiRoutes.post('/startCollectingReturns', function(request, response){
		setOrderStatus(request.body.orderId, "En Route to Customer", null, null, response);
	})

	apiRoutes.post('/completeDelivery', function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Marked_Delivered__c : new Date()
		}, function(err, data){
			setOrderStatus(request.body.orderId, "Delivered To Customer", "With Customer", null, response);
		});

	});

	apiRoutes.post("/returnItem", function(request, response){
		conn.sobject("OrderItem").update([
			{Id : request.body.Id, Status__c : "Returning", UnitPrice : 0}
		], function(err, rets){
			if(err)
				onError(err, repsonse);
			else
				response.status(200).send("Ok");
		})
	});

	apiRoutes.post("/startReturns", function(request, response){
		utils.log(request.body);
		conn.query("SELECT Id FROM Order_Store__c WHERE Order__c = '" + request.body.Id + "' AND Number_of_Returns__c > 0", function(queryError, data){
			if(queryError)
				onError(queryError, response);
			else{
				var deliveries = new Array();
				for(var i in data.records){
					deliveries.push({Id : data.records[i].Id, Status__c : "Return Started"});
				}
				conn.sobject("Order_Store__c").update(deliveries, function(err2, rets2){
					if(err2)
						onError(err2, response);
					else{
						setOrderStatus(request.body.Id, "Retrieved From Customer", null, null, response);
					}
				})
			}
		});
	});

	apiRoutes.post("/startPickup", function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Status__c : "Pick Up In Progress",
			Marked_Pick_Up_Start__c : new Date()
		}, function(err, result){
			if(err || !result.success)
				onError(err, response);
			else
				response.status(200).send("Ok");
		});
	});

	apiRoutes.post("/acceptDelivery", function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Status__c : "Accepted",
			Marked_Assigned__c : new Date(),
			Delivery_Shopping_Assistant__c : request.body.contactId
		}, function(err, result){
			if(err || !result.success)
				onError(err, response);
			else
				response.status(200).send("Ok");
		});
	});

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
				setOrderStatus(request.body.Id, "Completed", "Complete", "Purchased", response);
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
									setOrderStatus(request.body.OrderId, "All Items Returned to All Retailers", null, null, response);
								else
									response.status(200).send("Ok");
							});
						});
					}
				});
			}
		})
	});

	apiRoutes.post('/createOrderItem', function(request, response){
		var pbe = request.body.PricebookEntry;
		var orderShopifyId = request.body.OrderId;

		var orderItem = {
			Quantity : 1,
			UnitPrice : pbe.UnitPrice,
			Description : pbe.Product2.Name,
			Order_Store__r : {External_Id__c : orderShopifyId + ':' + pbe.Product2.Store__r.External_Id__c},
			Status__c : 'Requested',
			PricebookEntry : {External_Id__c : pbe.Product2.Shopify_Id__c + ':standard'},
			Order : {Shopify_Id__c : orderShopifyId}
		};

		conn.sobject("OrderItem").create(orderItem, function(err, ret){
			utils.log(err);
			if(!err)
				response.status(200).send("Ok");
			else
				onError(err, response);
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
