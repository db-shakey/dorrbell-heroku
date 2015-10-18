module.exports = function(apiRoutes, conn){

	var onError = function(err, response){
		response.status(400);
		response.send(err);
	}

	var globalDescribe;
	var updated = {};
	var socketConnection = new Array();
	var server;

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