module.exports = function(utils){
  var apiKey = '12ad97558a61e66e2b4bde6dd8f97cd9';
  var password = 'e465022f2fbf924b05f710f403758345';
  var http = require('https');

  return {
    getVariantMetafields : function(variantId){
      return new Promise(function(resolve, reject){
        var req = http.get({
          host : 'homefit.myshopify.com',
          path : '/admin/variants/' + variantId + '/metafields.json',
          auth : apiKey + ':' + password
        }, function(response){
          var body = '';
          response.on('data', function(d){
            body += d;
          });
          response.on('end', function(){
            resolve({
              variantId : variantId,
              metafields : JSON.parse(body)
            });
          });
          response.on('error', reject);
        });
        req.on('error', function(e) {
          utils.log(e);
        });
      })
    },

    getProductMetafields : function(productId){
      return new Promise(function(resolve, reject){
        var req = http.get({
          host : 'homefit.myshopify.com',
          path : '/admin/products/' + productId + '/metafields.json',
          auth : apiKey + ':' + password
        }, function(response){

          var body = '';
          response.on('data', function(d){
            body += d;
          });
          response.on('end', function(){
            resolve(JSON.parse(body));
          });
          response.on('error', reject);
        });

        req.on('error', function(e) {
          utils.log(e);
        });
      });
    },

    metaFilter : function(metaList, key){
      var value = metaList.filter(function(obj){
        return obj.key == key;
      });
      if(value && value.length > 0)
        return value[0].value;
      else
        return null;
    },

    getTransactionsForOrder : function(orderId){
      return new Promise(function(resolve, reject){
        var req = http.get({
          host : 'homefit.myshopify.com',
          path : '/admin/orders/' + orderId + '/transactions.json',
          auth : apiKey + ':' + password
        }, function(response){
          var body = '';
          response.on('data', function(d){
            body += d;
          });
          response.on('end', function(){
            resolve(JSON.parse(body));
          });
          response.on('error', reject);
        });
        req.on('error', function(e) {
          utils.log(e);
        });
      })
    }
  }
};
