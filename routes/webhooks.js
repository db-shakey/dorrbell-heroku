module.exports = function(route, conn, utils){

  route.post('/product/:route', function(req, res){
    utils.log(req.body);
  })


	route.post('/order/:route', function(req, res){

    utils.log(req.body);

    var order = req.body;

    conn.sobject("Order").create({
      BillingStreet : order.billing_address.address1,
      BillingCity : order.billing_address.city,
      BillingState : order.billing_address.province,
      BillingCountry : order.billing_address.country,
      Browser_IP__c : order.browser_ip,
      Accepts_Marketing__c : order.buyer_accepts_marketing,
      Cart_Token__c : order.cart_token,
      Checkout_Id__c : order.checkout_id,
      Checkout_Token__c : order.checkout_token,
      Browser_User_Agent__c : order.client_details.user_agent,
      Browser_Width__c : order.client_details.browser_width,
      Browser_Height__c : order.client_details.browser_height,
      Confirmed__c : order.confirmed
    });


    res.status(200).send();
  });

  route.post('/customer/:route', function(req, res){
    var route = req.params.route;
    var contact = req.body;
    var defaultAddress = (contact.default_address) ? contact.default_address : {};

    utils.log(req.body);
    if(route == 'delete'){
      conn.sobject("Contact").upsert({
        Shopify_Customer_ID__c : contact.id,
        Status__c : 'deleted'
      }, 'Shopify_Customer_ID__c', function(err, ret){
        if(err)
          utils.log(err);
        else
          res.status(200).send();
      });
    }else{
      conn.sobject("Contact").upsert({
        MailingStreet : defaultAddress.address1,
        MailingCity : defaultAddress.city,
        MailingCountry : defaultAddress.country,
        MailingPostalCode : defaultAddress.zip,
        MailingState : defaultAddress.province,
        Email : contact.email,
        Shopify_Customer_ID__c : contact.id,
        FirstName : contact.first_name,
        LastName : contact.last_name,
        Status__c : contact.state,
        HasOptedOutOfEmail : !contact.accepts_marketing,
        Email_Verified__c : contact.verified_email,
        Total_Spent__c : contact.total_spent,
        Tax_Exempt__c : contact.tax_exempt
      }, 'Shopify_Customer_ID__c', function(err, ret){
        if(err)
          utils.log(err);
        else
          res.status(200).send();
      });
    }
  });

};
