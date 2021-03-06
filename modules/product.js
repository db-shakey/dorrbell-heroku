module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);
  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  var getCloudinaryThumbnails = function(product){
    var cloudinary = require('cloudinary');
    var getThumbnailUrl = function(srcUrl, public_id){
      var p = new Promise(function(resolve, reject){
        cloudinary.uploader.upload(srcUrl, resolve, {"public_id" : public_id});
      });
      return p;
    }

    var promiseArray = new Array();

    for(var i = 0; i<product.images.length; i++){
      promiseArray.push(getThumbnailUrl(product.images[i].src, product.images[i].id));
      product.images[i].thumb = cloudinary.url(product.images[i].id, {width: 100, height: 150, crop: "scale", secure: true});
    }
  }

  return {
    upsertProduct : function(product){
      var metadata = new Array();
      for(var i = 0; i <product.variants.length; i++){
        metadata.push(shopify.getVariantMetafields(product.variants[i].id));
      }
      metadata.push(shopify.getProductMetafields(product.id));

      return Promise.all(metadata).then(function(res){
        getCloudinaryThumbnails(product);
        var body = {
          metadata : res,
          product : product
        }
        return conn.apex.post('/Product/', body);
      });

    },

    generateThumbnails : function(product){
      getCloudinaryThumbnails(product);
    },

    deleteProduct : function(productId){
      return conn.query("SELECT Id FROM Product2 WHERE Shopify_Id__c = '" + productId + "' OR Parent_Product__r.Shopify_Id__c = '" + productId + "'").then(
        function(result){
          for(var i = 0; i < result.records.length; i++){
            result.records[i].IsActive = false;
          }
          return conn.sobject("Product2").update(result.records);
        }
      );
    }
  }

};
