module.exports = function(apiRoutes, conn, socketUtils, utils){

	var globalDescribe;
	var updated = {};

	var onError = function(err, response){
		utils.log('----------ERROR------------');
		utils.log(err);
		response.status(400);
		response.send(err);
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
				conn.query("SELECT Id, Status__c FROM OrderItem WHERE OrderId = '" + orderId + "'", function(err, rets){
					if(err) reject(err);
					else{
						var idArray = new Array();
						for(var i in rets.records){

							var newItem = {
								Id : rets.records[i].Id,
								Status__c : itemStatus
							};
							if(itemStatus == 'Purchased' && rets.records[i].Status__c == 'Checked Out'){
								idArray.push(newItem);
							}else if(itemStatus != 'Purchased')
								idArray.push(newItem);
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

	var pagination = function(action, lim){
		var p = new Promise(function(resolve, reject){
			var records = [];
			action.on("record", function(record) {
				records.push(record);
			})
			.on("end", function() {
				resolve({
					records : records,
					hasMore : (action.totalFetched < action.totalSize)
				});
			})
			.on("error", function(err) {
				reject(err);
			})
			.run({ autoFetch : true, maxFetch : lim });
		});
		return p;
	}

	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.get('/searchAllItems/:searchString/:store/:limit', function(request, response){

		var wherePromise = new Promise(function(resolve, reject){
			var whereClause = "Name LIKE '%" + request.params.searchString.trim() + "%'";

			if(request.params.searchString.length > 2){
				var query ="FIND {*" + request.params.searchString + "*} IN ALL FIELDS \
										RETURNING Product2 \
											(Id WHERE \
													RecordType.DeveloperName = 'Product' \
													AND IsActive = TRUE \
													ORDER BY Family ASC \
											)";

				conn.search(query, function(err, res){
					if(!err && res && res.length > 0){
						whereClause = "Id IN ("
						for(var i in res){
							whereClause += "'" + res[i].Id + "', "
						}
						whereClause = whereClause.substring(0, whereClause.lastIndexOf(', ')) + ')';
						resolve(whereClause);
					}else if(res.length == 0){
						resolve(whereClause);
					}else
						reject(err);
				});
			}else{
				resolve(whereClause);
			}
		});
		wherePromise.then(function(whereClause){
			if(request.params.store && request.params.store.trim().length > 0)
				whereClause += " AND Store__c = '" + request.params.store + "'";
			var query = "SELECT Id, \
													Name, \
													Image__r.Image_Source__c, \
													Family, \
													Store__r.Name, \
													Brand__c, \
													(SELECT Id FROM Variants__r WHERE IsActive = TRUE) \
										FROM Product2 \
										WHERE  " + whereClause + " \
													AND RecordType.DeveloperName = 'Product' \
													AND IsActive = TRUE \
									ORDER BY Family ASC";
			pagination(conn.query(query), request.params.limit).then(function(res){
				response.status(200).send(res);
			}, function(err){
				onError(err, response);
			});
		});
	});

	apiRoutes.get('/searchProductByBarcode/:barcode/:store', function(request, response){
		var query = "SELECT Id, Parent_Product__c FROM Product2 WHERE Barcode__c = '" + request.params.barcode + "'";
		if(request.params.store && request.params.store != "undefined")
			query += " AND Store__c = '" + request.params.store + "'";

		conn.query(query, function(err, data){
			if(!err && data)
				response.status(200).send(data);
			else
				onError(err);
		})
	});


	apiRoutes.get('/searchStores/:searchString/:limit', function(request, response){
		var searchString = request.params.searchString.trim();
		var wherePromise = new Promise(function(resolve, reject){
			var whereClause = "Name LIKE '%" + searchString + "%'";
			if(searchString.length > 2){
				var query = "FIND {*" + searchString + "*} IN ALL FIELDS RETURNING Store__c(Id WHERE External_Id__c <> NULL ORDER BY Name ASC)";
				conn.search(query, function(err, res){
					if(!err && res && res.length > 0){
						whereClause = "Id IN ("
						for(var i in res){
							if(res[i].Id)
								whereClause += "'" + res[i].Id + "', "
						}
						utils.log(whereClause);
						whereClause = whereClause.substring(0, whereClause.lastIndexOf(', ')) + ')';
						utils.log(whereClause);
						resolve(whereClause);
					}else if(res.length == 0){
						resolve(whereClause);
					}else
						reject(err);
				});
			}else{
				resolve(whereClause);
			}
		}).then(function(whereClause){
			var query = "SELECT Id, Name, Address__c, Shopping_District__c FROM Store__c WHERE " + whereClause + " AND External_Id__c <> NULL ORDER BY Name ASC";
			pagination(conn.query(query), request.params.limit).then(function(res){
				response.status(200).send(res);
			}, function(err){
				onError(err, response);
			});
		});
	})

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
			Marked_Delivered__c : new Date(),
			Return_Collection_Time__c : request.body.returnCollectionTime,
			Return_Shopping_Assistant__c : (request.body.returnUser) ? request.body.returnUser : 'null'
		}, function(err, data){
			if(err)
				onError(err);
			else
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
						conn.sobject("Order").update({
							Id : request.body.Id,
							Marked_Retrieved__c : new Date()
						}, function(err, data){
							if(err)
								onError(err);
							else
								setOrderStatus(request.body.Id, "Retrieved From Customer", null, null, response);
						});
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

	apiRoutes.post("/acceptOrder", function(request, response){
		conn.sobject("Order").update({
			Id : request.body.orderId,
			Status__c : "Accepted",
			Delivery_Accepted_At__c : new Date()
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
			Return_Accepted_At__c : new Date()
		}, function(err, result){
			if(err || !result.success)
				onError(err, response);
			else
				response.status(200).send("Ok");
		})
	})

	apiRoutes.post("/completeOrder", function(request, response){
		var checkedOut = new Promise(function(resolve, reject){
			conn.query("SELECT Id FROM OrderItem WHERE (Status__c = 'Returning') AND OrderId = '" + request.body.Id + "'", function(err, rets){
				if(err)
					reject(err);
				else
					resolve(rets);
			});
		}).then(function(results){
			if(results.records && results.records.length > 0)
				onError("Invalid Items", response);
			else{
				conn.sobject("Order").update({
					Id : request.body.Id,
					Marked_Completed__c : new Date()
				}, function(err3, data3){
					if(err3)
						onError(err);
					else
						setOrderStatus(request.body.Id, "Completed", "Complete", "Purchased", response);
				});
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
								if(!data2.records || data2.records.length == 0){
									conn.sobject("Order").update({
										Id : request.body.OrderId,
										Marked_Returned__c : new Date()
									}, function(err3, data3){
										if(err3)
											onError(err);
										else{
											setOrderStatus(request.body.OrderId, "All Items Returned to All Retailers", null, null, response);
										}
									});
								}else
									response.status(200).send("Ok");
							});
						});
					}else{
						response.status(200).send("Ok");
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
			Status__c : 'Ready For Check Out',
			Price_Confirmed__c : true,
			Price_Confirmed_By__c : request.body.ContactId,
			Item_Confirmed__c : true,
			Item_Confirmed_By__c : request.body.ContactId,
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
	 * Shopify Updates
	 *************************/
	apiRoutes.post('/shopify/updateVariant', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		shopify.updateVariant(request.body).then(function(){
			response.status(200).send('Ok');
		}, function(err){
			onError(err, response);
		});
	})

	apiRoutes.post('/shopify/createVariant', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		shopify.createVariant(request.body.productId, request.body.variant).then(function(){
			response.status(200).send('Ok');
		}, function(err){
			onError(err, response);
		});
	})

	apiRoutes.post('/shopify/createProduct', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		var productModule = require('../modules/product')(utils, conn);
		shopify.createProduct(request.body).then(function(res){
			response.status(200).send(res);
		}, function(err){
			onError(err, response);
		});
	});

	apiRoutes.post('/shopify/updateProduct', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		shopify.updateProduct(request.body).then(function(res){
			response.status(200).send(res);
		}, function(err){
			onError(err, response);
		});
	});


	apiRoutes.get('/shopify/productTypes', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		shopify.getProductTypes().then(function(res){
			response.status(200).send(res);
		}, function(err){
			onError(err, response);
		});
	});
	apiRoutes.post('/shopify/deleteVariant', function(request, response){
		var shopify = require('../modules/shopify')(utils, conn);
		shopify.deleteVariant(request.body.productId, request.body.variantId).then(function(res){
			response.status(200).send(res);
		}, function(err){
			onError(err, response);
		});
	})


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
