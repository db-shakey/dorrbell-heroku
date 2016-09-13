module.exports = function(routes, conn, utils, firebase){

  var auth;

  routes.use(function(req, res, next){
    var that = this;
    firebase.auth().verifyIdToken(req.headers['authorization']).then(function(auth){
      that.auth = auth;
      next();
    }).catch(function(err){
        res.status(403).send(err);
    });
	})

  var getUserId = function(){
    var that = this;
    return new Promise(function(resolve, reject){
      console.log(that.auth.user_id);
      conn.query("SELECT Contact__c FROM Firebase_Record__c WHERE UID__c = '" + that.auth.user_id + "'").then(function(result){
        resolve(result.records[0].Contact__c);
      }, reject);
    })
  }

  routes.post('/variants', function(req, res){
    var shopify = require('../modules/shopify')(utils, conn);
    var promiseArray = [];
    for(var i in req.body){
      promiseArray.push(shopify.updateVariantFromProduct(req.body[i]));
    }
    Promise.all(promiseArray).then(function(data){
      res.status(200).send(data);
    }).catch(function(err){
      res.status(400).send(err);
    });
  });

  routes.post('/case', function(req, res){
    var onError = function(err){res.status(400).send(err);}
    getUserId().then(function(contactId){
      conn.sobject("Case").create({Subject : req.body.subject, Description : req.body.description, ContactId : contactId, Priority : 'low', Status : 'New', Reason: 'Other', Origin : 'Web'}).then(function(){
        res.status(200).send();
      }, onError)
    }, onError);
  });

  routes.post('/user', function(req, res){
    conn.sobject("Contact").update(req.body).then(function(){
      res.status(200).send();
    }, function(err){
      res.status(400).send(err);
    });
  });

  routes.post('/OrderItem/remove', function(req, res){
    getUserId().then(function(contactId){
      var orderItem = {
        Id :  req.body.product.Id,
        Item_Removed_By__c : contactId,
        Status__c : "Removed",
        Removed_Reason__c : req.body.product.Removed_Reason__c,
        UnitPrice : 0
      }
      conn.sobject("Order_Store__c").update({Status__c : 'Preparing Delivery', Id : req.body.deliveryId});
      conn.sobject("OrderItem").update(orderItem).then(function(){
        res.status(200).send();
      }, function(err){
        res.status(400).send(err);
      });
    });
  })

  routes.post('/OrderItem/verify', function(req, res){
    getUserId().then(function(contactId){
      var orderItem = {
        Id :  req.body.product.Id,
        Item_Confirmed__c : true,
        Item_Checked_Out_By__c : contactId,
        Status__c : "Ready For Check Out",
        UnitPrice : req.body.product.UnitPrice
      }
      conn.sobject("Order_Store__c").update({Status__c : 'Preparing Delivery', Id : req.body.deliveryId});
      conn.sobject("OrderItem").update(orderItem).then(function(){
        res.status(200).send();
      }, function(err){
        res.status(400).send(err);
      });
    }, function(err){
      res.status(400).send(err);
    });
  })

  routes.post('/delivery/accept/:id', function(req, res){
    conn.sobject("Order_Store__c").update({Status__c : 'Accepted By Retailer', Id : req.params.id}).then(function(){
      res.status(200).send();
    }, function(err){
      res.status(400).send(err);
    })
  })

};
