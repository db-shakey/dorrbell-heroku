module.exports = function(route, conn, utils){

  /**
  * All webhook requests go through webhooks
  */
  //authenticate requests
  route.use(function(req, res, next){
      if(utils.verifyWebhook(req))
        next();
      else
        res.status(401).send("Invalid Signature");
  });

  /**************************
	 * Product
	 *************************/
  route.post('/product/:route', function(req, res){
    var product = req.body;
    var route = req.params.route;
    var productModule = require('../modules/product')(utils, conn);

    if(product){
      if(route == 'update' || route == 'create')
        productModule.upsertProduct(product).then(function(){

        }, function(err){
          utils.log(err);
        });
      else if(route == 'delete')
        productModule.deleteProduct(product.id).then(function(){

        }, function(err){
          utils.log(err);
        });
    }
    res.status(200).send();
  })

  /**************************
	 * Order
	 *************************/
	route.post('/order/:route', function(req, res){
    var order = req.body;
    var route = req.params.route;
    var orderModule = require('../modules/order')(utils, conn);

    if(order){
      if(route == 'update' || route == 'create'){
        orderModule.upsertOrder(order).then(function(){
        }, function(err){
          utils.log(err);
        })
      }
    }
    res.status(200).send();
  });


  /**************************
	 * Customer
	 *************************/
  route.post('/customer/:route', function(req, res){
    var route = req.params.route;
    var contact = req.body;
    var defaultAddress = (contact.default_address) ? contact.default_address : {};

    if(route == 'delete'){
      conn.sobject("Contact").upsert({
        Shopify_Customer_ID__c : contact.id,
        Status__c : 'deleted'
      }, 'Shopify_Customer_ID__c', function(err, ret){
        if(err)
          utils.log(err);
      });
    }else{
      conn.sobject("Contact").upsert({
        MailingStreet : defaultAddress.address1,
        MailingCity : defaultAddress.city,
        MailingCountry : defaultAddress.country,
        MailingPostalCode : defaultAddress.zip,
        MailingState : defaultAddress.province,
        Email : contact.email,
        Username__c : contact.email,
        Shopify_Customer_ID__c : contact.id,
        FirstName : contact.first_name,
        LastName : contact.last_name,
        Status__c : contact.state,
        MobilePhone : defaultAddress.phone,
        HasOptedOutOfEmail : !contact.accepts_marketing,
        Email_Verified__c : contact.verified_email,
        Total_Spent__c : contact.total_spent,
        Tax_Exempt__c : contact.tax_exempt
      }, 'Username__c', function(err, ret){
        if(err)
          utils.log(err);
      });
    }
    res.status(200).send();
  });

  /**************************
	 * Cart
	 *************************/
  route.post('/cart/:route', function(req, res){
    var body = {
      cart : req.body
    };
    conn.apex.post('/Cart/', body);
    res.status(200).send();
  });
};
