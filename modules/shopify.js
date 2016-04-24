module.exports = function(utils, conn){
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
            resolve(JSON.parse(body));
          });
          response.on('error', reject);
        });
        req.on('error', function(e) {
          utils.log(e);
        });
      });
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
    },

    createCustomer : function(customer){
      return new Promise(function(resolve, reject){

        var req = require('request');
        var postData = {
            "customer" : {
              "first_name" : customer.FirstName,
              "last_name" : customer.LastName,
              "email" : customer.Email,
              "verified_email" : true,
              "password" : customer.Password__c,
              "password_confirmation" : customer.Password__c,
              "send_email_welcome" : false
            }
        };

        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/customers.json',
          method : 'POST',
          form : postData
        }, function(err, res, body){
          if(!err)
            resolve(body);
          else
            reject(err);
        });
      })
    },

    updateVariant : function(product){
      var req = require('request');
      var productModule = require('../modules/product')(utils, conn);

      var updateVariantPromise = function(){
        return new Promise(function(resolve, reject){
          var getOptionValue = function(name, product){
            var value;
            for(var i in product.Product_Options__r.records){
              var o = product.Product_Options__r.records[i];
              if(o.Option__r && o.Option__r.Name == name)
                value = o.Value__c;
            }
            return value;
          }

          var postData = {
            "variant" : {
              "id" : product.Shopify_Id__c,
              "option1" : getOptionValue('Size', product),
              "option2" : getOptionValue('Color', product),
              "sku" : product.SKU__c,
              "barcode" : product.Barcode__c,
              "inventory_quantity" : product.Inventory_Quantity__c
            }
          };
          req({
            uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/variants/' + product.Shopify_Id__c + '.json',
            method : 'PUT',
            body : postData,
            json : true
          }, function(err, res, body){
            if(!err)
              resolve(product.Parent_Product__r.Shopify_Id__c);
            else
              reject(err);
          });
        });
      };

      var updatePricePromise = function(data){
        return new Promise(function(resolve, reject){
          var promiseArray = new Array();
          var metaFieldArray = ['metaprice', 'metalistprice', 'metalistpricecurrent'];

          for(var i in data.metafields.metafields){
            var index = metaFieldArray.indexOf(data.metafields.metafields[i].key);
            if(index >= 0)
              metaFieldArray.splice(index, 1);

            promiseArray.push(new Promise(function(resolveMeta, rejectMeta){
              data.metafields.metafields[i].value = product.PricebookEntries.records[0].UnitPrice * 100;
              req({
                uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/metafields/' + data.metafields.metafields[i].id + '.json',
                method : 'PUT',
                form : {
                  "metafield" : data.metafields.metafields[i]
                }
              }, function(err, res, body){
                if(!err)
                  resolveMeta(body);
                else
                  rejectMeta(err);
              });
            }));
          }
          for(var i in metaFieldArray){
            promiseArray.push(new Promise(function(resolveMeta, rejectMeta){
              req({
                uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/variants/' + product.Shopify_Id__c + '/metafields.json',
                method : 'POST',
                form : {
                  "metafield" : {
                    "namespace" : "price",
                    "key" : metaFieldArray[i],
                    "value" : product.PricebookEntries.records[0].UnitPrice * 100,
                    "value_type" : "integer"
                  }
                }
              }, function(err, res, body){
                if(!err)
                  resolveMeta(body);
                else
                  rejectMeta(err);
              });
            }));
          }

          Promise.all(promiseArray).then(resolve, reject);
        });
      }

      return this.getVariantMetafields(product.Shopify_Id__c)
                  .then(updatePricePromise)
                  .then(updateVariantPromise)
                  .then(this.getProduct)
                  .then(productModule.upsertProduct);

    },
    createVariant : function(productId, variant){
      var productModule = require('../modules/product')(utils, conn);
      var req = require('request');
      var that = this;
      return new Promise(function(resolve, reject){
        var postData = {
          "variant" : variant
        }
        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/products/' + productId + '/variants.json',
          method : 'POST',
          body : postData,
          json : true
        }, function(err, res, body){
          if(!err && !body.errors)
            that.getProduct(productId).then(productModule.upsertProduct).then(resolve, reject);
          else if(body.errors)
            reject(body.errors);
          else
            reject(err);
        });
      })
    },

    createProduct : function(product){
      var req = require('request');
      return new Promise(function(resolve, reject){
        var postData = {
          "product" : product
        }
        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/products.json',
          method : 'POST',
          body : postData,
          json : true
        }, function(err, res, body){
          if(!err && !body.errors)
            resolve(body);
          else if(body.errors)
            reject(body.errors);
          else
            reject(err);
        });
      })
    },

    updateProduct : function(product){
      var req = require('request');
      var that = this;
      var productModule = require('../modules/product')(utils, conn);
      return new Promise(function(resolve, reject){
        var postData = {
          "product" : product
        }
        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/products/' + product.id + '.json',
          method : 'PUT',
          body : postData,
          json : true
        }, function(err, res, body){
          if(!err && !body.errors)
            that.getProduct(product.id).then(productModule.upsertProduct).then(resolve, reject);
          else if(body.errors)
            reject(body.errors);
          else
            reject(err);
        });
      });
    },

    getProductTypes : function(){
      Array.prototype.contains = function(v) {
          for(var i = 0; i < this.length; i++) {
              if(this[i] === v) return true;
          }
          return false;
      };
      Array.prototype.unique = function() {
          var arr = [];
          for(var i = 0; i < this.length; i++) {
              if(!arr.contains(this[i])) {
                  arr.push(this[i]);
              }
          }
          return arr;
      }
      return new Promise(function(resolve, reject){
        var req = http.get({
          host : 'homefit.myshopify.com',
          path : '/admin/products.json?fields=product_type',
          auth : apiKey + ':' + password
        }, function(response){
          var body = '';
          response.on('data', function(d){
            body += d;
          });
          response.on('end', function(){
            var distinct = new Array();
            var products = JSON.parse(body).products;
            for(var i in products){
              if(products[i].product_type && products[i].product_type != null)
                distinct.push(products[i].product_type);
            }
            resolve(distinct.unique());
          });
          response.on('error', reject);
        });
        req.on('error', function(e) {
          utils.log(e);
        });
      })
    },

    getProduct : function(shopifyId){
      var req = require('request');


      return new Promise(function(resolve, reject){
        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/products/' + shopifyId + '.json',
          method : 'GET'
        }, function(err, res, body){
          if(!err && !body.errors)
            resolve(JSON.parse(body).product);
          else if(body.errors)
            reject(body.errors);
          else
            reject(err);
        });
      });

    },

    deleteVariant : function(productId, variantId){
      var req = require('request');
      var productModule = require('../modules/product')(utils, conn);
      return new Promise(function(resolve, reject){
        req({
          uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/products/' + productId + '/variants/' + variantId + '.json',
          method : 'DELETE'
        }, function(err, res, body){
          if(!err && !body.errors)
            productModule.deleteProduct(variantId).then(resolve, reject);
          else if(body.errors)
            reject(body.errors);
          else
            reject(err);
        });
      })
    }
  }
};
