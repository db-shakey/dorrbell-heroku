module.exports = function(routes, utils, conn){
  var path = require('path');
  var excludeFields = ['LastModifiedDate', 'OrderNumber', 'CreatedById', 'IsDeleted', 'IsReductionOrder', 'Return_Shopping_Assistant_Phone__c',
                      'CreatedDate', 'Delivery_Shopping_Assistant_Phone__c', 'TotalAmount', 'SystemModstamp', 'LastModifiedById', 'attributes'];

  /**************
   * Firebase Server
   *************/
  var firebase = require('firebase');
  firebase.initializeApp({
    serviceAccount: process.env.firebaseCredentials,
    databaseURL: process.env.firebaseUrl,
    databaseAuthVariableOverride: {
      uid: "my-service-worker"
    }
  });
  var db = firebase.database();

  db.ref('customers').orderByKey().on('child_added', function(customer){
    db.ref('customers').child(customer.key).child('carts').on("child_added", function(cart){
      var cart = cart.val();
      if(cart.Id)
        delete cart.Id
      conn.sobject("Cart__c").upsert(cart, "Shopify_Id__c").then(function(res){utils.log(res);}, function(err){utils.log(err);});
    })
  });

  var ref = db.ref('customers')

  routes.post('/fb/customers', function(req, res){
    var ref = db.ref('customers');

    var obj = {};
    obj[req.body.firebaseId] = req.body;
    if(!db.ref('customers/' + req.body.firebaseId))
      ref.set(obj);
    else
      ref.update(obj);

    res.status(200).send();
  });

  routes.delete('/fb/customers', function(req, res){
    var ref = db.ref('customers');
    ref.child(req.body.firebaseId).remove();
    res.status(200).send();
  });

  routes.post('/fb/locations', function(req, res){
    var obj = {};
    for(var i = 0; i<req.body.length; i++){
      obj[req.body[i].Postal_Code__c] = req.body[i];
    }

    if(!db.ref('locations'))
      db.ref('locations').set(obj);
    else
      db.ref('locations').update(obj);
  });

  routes.delete('/fb/locations', function(req, res){
    var ref = db.ref('locations');
    ref.child(req.body.Id).remove();
    res.status(200).send();
  });

  return routes;
};
