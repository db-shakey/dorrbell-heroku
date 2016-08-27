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
    conn.query("SELECT Contact__c FROM Firebase_Record__c WHERE UID__c = '" + this.auth.user_id + "'").then(function(result){
      conn.sobject("Case").create({Subject : req.body.subject, Description : req.body.description, ContactId : result.records[0].Contact__c, Priority : 'low', Status : 'New', Reason: 'Other', Origin : 'Web'}).then(function(){
        res.status(200).send();
      }, onError)
    }, onError)
  });

  routes.post('/user', function(req, res){
    conn.sobject("Contact").update(req.body).then(function(){
      res.status(200).send();
    }, function(err){
      res.status(400).send(err);
    });
  });

};
