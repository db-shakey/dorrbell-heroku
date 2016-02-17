module.exports = function(routes, utils){

  var braintree = require("braintree");
  var gateway;

  var onError = function(err, response){
		utils.log(err);
		response.status(400);
		response.send(err);
	}

  routes.use(function(req, res, next){
    utils.log('checking');
    utils.log(req.body);
    utils.log(req.body);
    if(req.body.bt){
      gateway = braintree.connect({
        environment: braintree.Environment.Production,
        merchantId : req.body.bt.merchantId,
        publicKey : req.body.bt.publicKey,
        privateKey : req.body.bt.privateKey
      });
      next();
    }else{
      return res.status(403).send({
        success : false,
        message : 'Invalid Braintree Credentials'
      });
    }
  });

  routes.post('/transaction/clone', function(req, res){
    utils.log('cloning');
    utils.log(req.body);
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

};
