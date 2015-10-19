module.exports = function(apiRoutes, conn){

	var globalDescribe;
	var updated = {};
	var socketConnection = new Array();
	var server;

	var onError = function(err, response){
		response.status(400);
		response.send(err);
	}

	var querySearchResults = function(query, response){
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
					conn.query("SELECT Id, \
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
							WHERE " + where, function(err, queryData){
						if(err)
							onError(err, response);
						response.json(queryData);			
					});
				}

				
			}
		});
	}

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
	})

	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.post('/query', function(request, response){
		var query = request.body.query.replace(new RegExp('SELECT ', 'g'), 'SELECT LastModifiedDate, ');
		conn.query(query, function(err, data){
			if(err)
				onError(err, response);

			response.json(data.records);
		});
	});

	apiRoutes.get('/searchAllItems/:searchString/:latitude/:longitude', function(request, response){
		var text = request.params.searchString;
		var geo = "GEOLOCATION(" + request.params.latitude + "," + request.params.longitude + ")";
		querySearchResults("FIND {*" + text + "*} IN ALL FIELDS RETURNING Variant__c(Id ORDER BY DISTANCE(Dorrbell_Product__r.Store__r.Coordinates__c, " + geo + ", 'mi')), Dorrbell_Product__c(Id ORDER BY DISTANCE(Store__r.Coordinates__c, " + geo + ", 'mi'))", response);
		
	});
	apiRoutes.get('/searchStoreItems/:store/:searchString', function(request, response){
		var store = request.params.store;
		var text = request.params.searchString;
		console.log(request);
		querySearchResults("FIND {*" + text + "*} IN ALL FIELDS RETURNING Variant__c(Id WHERE Store_Id__c = '" + store + "'), Dorrbell_Product__c(Id)", response);

	})

	apiRoutes.get('/describe/:sObject', function(request, response){
		conn.describe(request.params.sObject, function(err, meta){
			if(err)
				onError(err, response);

			response.json(meta);
		})
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
			if(server)
				server.clients.forEach(function each(client){
					client.send(retsJSON);
				})

			response.status(200).send("Ok");
		})
	});

	apiRoutes.get("/me", function(request, response){
		response.send(request.decoded);
	});

	return {
		addConnection : function(conn){
			var index = socketConnection.push(conn) - 1;
			conn.on('close', function(closed){
				console.log((new Date()) + " Peer "
                + closed + " disconnected.");
				socketConnection.splice(index, 1);
			});
		},

		setServer : function(s){
			server = s;
		}
	}

}