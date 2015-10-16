module.exports = function(apiRoutes, conn){

	var onError = function(err, response){
		response.status(400);
		response.send(err);
	}

	var globalDescribe;
	var updated = {};
	var socketConnection;

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
		console.log(query);
		conn.query(query, function(err, data){
			if(err)
				onError(err, response);

			response.json(data.records);
		});
	});

	apiRoutes.get('/describe/:sObject', function(request, response){
		conn.describe(request.params.sObject, function(err, meta){
			if(err)
				onError(err, response);

			response.json(meta);
		})
	});

	apiRoutes.post('/update/:sObject', function(request, response){
		/*
		var checkUpdate = function(describe, idArray){
			var objMap = {};
			for (var i = 0; i< idArray.length; i++){
				var key = idArray[i];
				if(key.id.length > 3){
					var sobject = describe.sobjects.filter(function(value){
						return (key.id.substring(0, 3) == value.keyPrefix);
					})[0].name;
					if(sobject && !objMap[sobject]){
						objMap[sobject] = "('" + key.id + "'";
					}else if(sobject){
						objMap[sobject] += (", '" + key.id + "'");
					}
				}
			}
			var executed = 0;
			for (var key in objMap) {
			  if (objMap.hasOwnProperty(key)) {
			    conn.query("SELECT Id, LastModifiedDate FROM " + key + " WHERE Id IN " + objMap[key] + ")", function(err, data){
		    		for(var d = 0; d < data.records.length; d++){
		    			var record = data.records[d];
		    			updated[record.Id] = record.LastModifiedDate;
		    		}
			    });
			  }
			}
		}*/

		

		conn.sobject(request.params.sObject).update([
			request.body
		], function(err, rets){
			if (err) { return console.error(err); }
			for (var i=0; i < rets.length; i++) {
			    if (!rets[i].success) {
			      	onError(err, response);
			    }
			}
			/*
			if(!globalDescribe){
				conn.describeGlobal(function(err, res){
					if(err)
						onError(err, response)
					else{
						globalDescribe = res;
						checkUpdate(globalDescribe, rets);
					}
				})
			}else
				checkUpdate(globalDescribe, rets);
			*/
			if(socketConnection)
				socketConnection.send(JSON.stringify(rets));
			response.status(200).send("Ok");
		})
	});

	apiRoutes.get("/me", function(request, response){
		response.send(request.decoded);
	});

	return {
		setConnection : function(conn){
			socketConnection = conn;
		}
	}

}