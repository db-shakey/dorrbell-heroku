module.exports = function(routes, utils){

  var braintree = require("braintree");
  var shopify = require('../modules/shopify')(utils);

  var onError = function(err, response){
		utils.log(err);
		response.status(400);
		response.send(err);
	}

  return {
    startProductPoll : function(conn){
      var CronJob = require('cron').CronJob;
      new CronJob('0 * * * *', function() {
        shopify.getAllProducts().then(function(products){
          utils.log('executing product update');

          var promiseArray = new Array();
          var variantArray = new Array();

          for(var i in products){
            for(var x in products[i].variants){
              variantArray.push(products[i].variants[x].id);
            }
          }

          var getMetafields = function(index){
            setTimeout(function(){
              if(index < variantArray.length){
                promiseArray.push(shopify.getVariantMetafields(variantArray[index]));
                getMetafields(index + 1);
              }else{
                finalize();
              }
            }, 500);
          }

          var finalize = function(){
            Promise.all(promiseArray).then(function(metadata){
              var body = {
                "products" : products,
                "metadata" : metadata
              };
              utils.log(body);
              conn.apex.put('/Product/', body);
            }, function(err){
              onError(err, res);
            });
          }

          getMetafields(0);


        }, function(err){
          onError(err, res);
        })
      }, null, true, 'America/Los_Angeles');
    }
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

};
