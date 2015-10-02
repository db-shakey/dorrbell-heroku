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
			withRelated : [
				{
				'orders': function(qb){
							qb.where('delivery_date__c', '<>', 'null').andWhere('drop_off_time__c', '<>', 'null');	
						}
				}
			]
		}).then(function(records){
			var orders = records.related('orders');
			orders.forEach(function(n){
				n.set("recordtypename", request.params.orderType);
			})

			response.send(orders);
		}, function(err){onError(err, response);});
	});

	apiRoutes.get('/order/:orderId', function(request, response){
		new models.Order({'sfid' : request.params.orderId}).fetch({
			withRelated : ['deliveries', 'recordtype']
		}).then(function(records){
			response.send(records);
		});
	});

	apiRoutes.post('/order/:orderId', function(request, response){
		new models.Order({'sfid' : request.params.orderId}).save(request.body, {patch : true})
		.then(function(model){
			response.send(model);
		});
	})

}