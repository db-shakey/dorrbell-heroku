module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);
  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  return {
    upsertProduct : function(product){
      var metadata = new Array();
      for(var i = 0; i <product.variants.length; i++){
        metadata.push(shopify.getVariantMetafields(product.variants[i].id));
      }
      metadata.push(shopify.getProductMetafields(product.id));

      return Promise.all(metadata).then(function(res){
        var body = {
          metadata : res,
          product : product
        }
        utils.log(body);
        return conn.apex.post('/Product/', body);
      });

    },

    deleteProduct : function(productId){
      return conn.query("SELECT Id FROM Product2 WHERE Shopify_Id__c = '" + productId + "' OR Parent_Product__r.Shopify_Id__c = '" + productId + "'").then(
        function(result){
          for(var i = 0; i < result.records; i++){
            result.records[i].IsActive = false;
          }
          return conn.sobject("Product2").update(result.records);
        }
      );
    }
  }

};
