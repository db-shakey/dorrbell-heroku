module.exports = function(apiRoutes, conn){

	var onError = function(err, response){
		response.status(403);
		response.send(err);
	}

	
	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.post('/query', function(request, response){
		console.log(request.body.query);
		conn.query(request.body.query, function(err, data){
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
			response.status(200).send("Ok");
		})
	})

}