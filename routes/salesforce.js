module.exports = function(routes, utils){

  var braintree = require("braintree");
  var shopify = require('../modules/shopify')(utils);

  var onError = function(err, response){
		utils.log(err);
		response.status(400);
		response.send(err);
	}


  routes.post('/transaction/clone', function(req, res){
    var gateway;

    if(req.body.bt){
      gateway = braintree.connect({
        environment: braintree.Environment.Production,
        merchantId : req.body.bt.merchantId,
        publicKey : req.body.bt.publicKey,
        privateKey : req.body.bt.privateKey
      });
    }else{
      return res.status(403).send({
        success : false,
        message : 'Invalid Braintree Credentials'
      });
    }
    if(req.body.bTransaction && req.body.bTransaction.transactionId){
      gateway.transaction.cloneTransaction(req.body.bTransaction.transactionId, {
        amount : req.body.bTransaction.amount,
        options : {
          submitForSettlement : req.body.bTransaction.submitForSettlement
        }
      }, function(err, result){
        if(err)
          onError(err, res);
        else
          res.status(200).send(result);
      });
    }else{
      onError("Invalid transaction data", res);
    }
  });

  routes.get('/shopify/products', function(req, res){
    shopify.getAllProducts().then(function(products){
      res.status(200).send(products);
    }, function(err){
      onError(err, res);
    })
  })

};
