var db = require('../middlewares/salesforce');

exports.search = function(query){

}

exports.create = function(req){
  if(!req.customer){
    req.customer = {
      MailingStreet : '170 West Tasman Drive',
      MailingCity : 'San Jose',
      MailingState : 'California',
      MailingPostalCode : '95134'
    }
  }

  return db.getConnection().sobject("Order").create({
			AccountId: '001410000053iKz',
			EffectiveDate : new Date(),
			Status: 'Draft',
			Pricebook2Id : '01s41000001xYVf',
			ShippingStreet : req.customer.MailingStreet,
			ShippingState : req.customer.MailingState,
			ShippingCity : req.customer.MailingCity,
			ShippingPostalCode : req.customer.MailingPostalCode,
      ShippingCountry: 'United States',
      BillingStreet : req.customer.MailingStreet,
			BillingState : req.customer.MailingState,
			BillingCity : req.customer.MailingCity,
			BillingPostalCode : req.customer.MailingPostalCode,
      BillingCountry: 'United States'
		}).then(function(record){
			var orderId = record.id;

			var orderItemArray = new Array();
			for(var i = 0; i<req.items.length; i++){
				var product = req.items[i];
				orderItemArray.push({
					OrderId: orderId,
					PricebookEntryId : product.PricebookEntryId,
					Quantity: product.quantity,
					UnitPrice : product.Price
				})
			}
      console.log(orderItemArray);
			db.getConnection().sobject("OrderItem").create(orderItemArray).then(function(data){
				res.status(200).send(data)
			}, function(err){rconsole.log(err); res.status(400).send(err);});
		}, function(err){console.log(err); res.status(400).send(err);});
}
