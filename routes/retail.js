module.exports = function(routes, conn, utils, firebase){

  var uid;

  routes.use(function(req, res, next){
    var that = this;
    firebase.auth().verifyIdToken(req.headers['authorization']).then(function(uid){
      that.uid = uid;
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
  })

};
