module.exports = function(routes, utils){

  var braintree = require("braintree");
  var shopify = require('../modules/shopify')(utils);

  var onError = function(err, response){
		utils.log(err);
		response.status(400);
		response.send(err);
	}

  if(routes){
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
  }

  return {
    startProductPoll : function(conn){
      var CronJob = require('cron').CronJob;
      var that = this;
      new CronJob('30 2 * * *', function() {
        that.syncProducts(conn);
      }, null, true, 'America/Los_Angeles');
    },
    syncProducts : function(conn, vendor){
      utils.log('starting sync process at ' + new Date() + ' for vendor ' + vendor);
      var cloudinary = require('cloudinary');

      shopify.getAllProducts(vendor).then(function(products){
        utils.log('syncing ' + products.length + ' products');
        var promiseArray = new Array();
        var variantArray = new Array();
        var existingImages = new Array();

        var getMetafields = function(index){
          utils.log('getting metafields ' + index);
          setTimeout(function(){
            if(index < variantArray.length){
              promiseArray.push(shopify.getVariantMetafields(variantArray[index]));
              getMetafields(index + 1);
            }else{
              finalize();
            }
          }, 1000);
        }

        var finalize = function(){
          utils.log('finalizing');
          Promise.all(promiseArray).then(function(metadata){
            var body = {
              "products" : products,
              "metadata" : metadata
            };
            utils.log(body);
            conn.apex.put('/Product/', body);
            utils.log('finished sync process at ' + new Date());
          }, function(err){
            onError(err, res);
          });
        }

        var deletingImages = new Array();
        var total;

        var deleteUnusedImages = function(imageArray, start, offset){
          utils.log('deleting unused images');
          var subSet = imageArray.slice(start, offset);
          cloudinary.api.delete_resources(subSet, function(result){
            if(offset < imageArray.length){
              var newOffset = (offset + 100 < imageArray.length) ? offset + 100 : imageArray.length;
              deleteUnusedImages(imageArray, offset, newOffset);
            }else{
              console.log(result);
            }
          });
        }

        var findUnusedImages = function(next_cursor){
          utils.log('finding unused images');
          var params = {max_results : 500};
          if(next_cursor)
            params.next_cursor = next_cursor;

          cloudinary.api.resources(
            function(result){
              total = result.resources.length;
              for(var i = 0; i<result.resources.length; i++){
                var found = false;
                for(var x = 0; x<existingImages.length; x++){
                  if(existingImages[x] == result.resources[i].public_id)
                    found = true;
                }
                if(!found)
                  deletingImages.push(result.resources[i].public_id);
              }
              if(result.next_cursor)
                findUnusedImages(result.next_cursor);
              else{
                deleteUnusedImages(deletingImages, 0, 100);
              }

            },
            params
          )
        }

        for(var i = 0; i<products.length; i++){
          for(var x = 0; x <products[i].variants.length; x++){
            variantArray.push(products[i].variants[x].id);
          }
          for(var x = 0; x < products[i].images.length; x++){
            existingImages.push(products[i].images[x].id);
          }
        }
        utils.log('generated variant array ' + variantArray.length + ' and image array ' + existingImages.length);

        findUnusedImages();

        getMetafields(0);
      }, function(err){
        onError(err, res);
      });
    }
  }

};
