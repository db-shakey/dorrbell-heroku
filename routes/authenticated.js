module.exports = function(apiRoutes, models){

	var onError = function(err, response){
		response.status(403);
		response.send(err);
	}

	apiRoutes.get('/ping', function(request, response){
		response.send('valid_token');
	});

	apiRoutes.get('/orders/:orderType', function(request, response){
		new models.RecordType({'developername' : request.params.orderType}).fetch({
			withRelated : ['orders']
		}).then(function(records){
			response.send(records.related('orders'));
		}, function(err){onError(err, response);});
	});

	apiRoutes.get('/orderdetails/:orderId', function(request, response){
		new models.Order({'sfid' : request.params.orderId}).fetch({
			withRelated : ['deliveries']
		}).then(function(records){
			response.send(records);
		});
	})

}