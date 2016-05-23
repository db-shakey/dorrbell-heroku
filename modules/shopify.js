module.exports = function(utils, conn){
  var apiKey = '12ad97558a61e66e2b4bde6dd8f97cd9';
  var password = 'e465022f2fbf924b05f710f403758345';
  var http = require('https');

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

  var doCallout = function(method, path, postData){
    var req = require('request');

    return new Promise(function(resolve, reject){
      req({
        uri : 'https://' + apiKey + ':' + password + '@homefit.myshopify.com/admin/' + path,
        method : method,
        body : postData,
        json : true
      }, function(err, res, body){
        if(!err && (body && !body.errors))
          resolve(body);
        else if(body && body.errors)
          reject(body.errors);
        else if(err)
          reject(err);
        else
          resolve();
      });
    });
  }

  return {
    getVariantMetafields : function(variantId){
      return doCallout('GET', 'variants/' + variantId + '/metafields.json');
    },

    getProductMetafields : function(productId){
      return doCallout('GET', 'products/' + productId + '/metafields.json');
    },

    getTransactionsForOrder : function(orderId){
      return doCallout('GET', 'orders/' + orderId + '/transactions.json');
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



    createCustomer : function(customer){
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
      return doCallout('POST', 'customers.json', postData);
    },

    updateVariantFromProduct : function(product){
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
          doCallout('PUT', 'variants/' + product.Shopify_Id__c + '.json', postData).then(function(){
            resolve(product.Parent_Product__r.Shopify_Id__c);
          }, reject);
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
              doCallout('PUT', 'metafields/' + data.metafields.metafields[i].id + '.json', {
                "metafield" : data.metafields.metafields[i]
              }).then(resolveMeta, rejectMeta);
            }));
          }

          for(var i in metaFieldArray){
            promiseArray.push(new Promise(function(resolveMeta, rejectMeta){
              doCallout('POST', 'variants/' + product.Shopify_Id__c + '/metafields.json', {
                "metafield" : {
                  "namespace" : "price",
                  "key" : metaFieldArray[i],
                  "value" : product.PricebookEntries.records[0].UnitPrice * 100,
                  "value_type" : "integer"
                }
              }).then(resolveMeta, rejectMeta);
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
      var that = this;
      return new Promise(function(resolve, reject){
        var postData = {
          "variant" : variant
        }
        doCallout('POST', 'products/' + productId + '/variants.json', postData).then(function(){
          that.getProduct(productId).then(productModule.upsertProduct).then(resolve, reject)
        }, reject);
      });
    },

    createProduct : function(product){
      var postData = {
        "product" : product
      }
      return doCallout('POST', 'products.json', postData);
    },

    updateProduct : function(product){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);


      return new Promise(function(resolve, reject){
        var postData = {
          "product" : product
        }
        doCallout('PUT', 'products/' + product.id + '.json', postData).then(function(){
          that.getProduct(product.id).then(productModule.upsertProduct).then(resolve, reject);
        }, reject);
      });
    },

    updateVariant : function(variant, parentProductId){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);


      return new Promise(function(resolve, reject){
        var postData = {
          "variant" : variant
        }
        doCallout('PUT', 'variants/' + variant.id + '.json', postData).then(function(){
          that.getProduct(parentProductId).then(productModule.upsertProduct).then(resolve, reject);
        }, reject);
      });
    },

    updateVariantBatch : function(variantArray, parentProductId){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);
      var pArray = new Array();

      for(var i = 0; i<variantArray.length; i++){
        pArray.push(doCallout('PUT', 'variants/' + variantArray[i].id + '.json', {"variant" : variantArray[i]}));
      }
      return Promise.all(pArray).then(function(){
        return that.getProduct(parentProductId).then(productModule.upsertProduct);
      });
    },

    createProductImage : function(image, productId){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);
      var postData = {
        "image" : image
      }
      return doCallout('POST', 'products/' + productId + '/images.json', postData).then(function(){
        return that.getProduct(productId).then(productModule.upsertProduct);
      });
    },

    deleteImage : function(imageId, productId){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);
      return doCallout('DELETE', 'products/' + productId + '/images/' + imageId + '.json').then(function(){
        return that.getProduct(productId).then(productModule.upsertProduct);
      });
    },

    updateImage : function(image, productId){
      var that = this;
      var productModule = require('../modules/product')(utils, conn);
      var postData = {
        "image" : image
      }
      return doCallout('PUT', 'products/' + productId + '/images/' + image.id + '.json', postData).then(function(){
        return that.getProduct(productId).then(productModule.upsertProduct);
      });
    },

    getProductTypes : function(){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'products.json?fields=product_type').then(function(body){
          var distinct = new Array();
          var products = body.products;
          for(var i in products){
            if(products[i].product_type && products[i].product_type != null)
              distinct.push(products[i].product_type);
          }
          resolve(distinct.unique());
        }, reject);
      });
    },

    getProductTags : function(){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'products.json?fields=tags').then(function(body){
          var distinct = new Array();
          var products = body.products;
          for(var i in products){
            if(products[i].tags && products[i].tags != null){
              var productTags = products[i].tags.split(", ");
              distinct = distinct.concat(productTags);
            }
          }
          resolve(distinct.unique());
        }, reject);
      });
    },

    getSizes : function(){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'variants.json?fields=option1').then(function(body){
          var distinct = new Array();
          for(var i in body.variants){
            if(body.variants[i].option1 && body.variants[i].option1 != null)
              distinct.push(body.variants[i].option1);
          }
          resolve(distinct.unique());
        }, reject);
      });
    },

    getColors : function(){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'variants.json?fields=option2').then(function(body){
          var distinct = new Array();
          for(var i in body.variants){
            if(body.variants[i].option2 && body.variants[i].option2 != null)
              distinct.push(body.variants[i].option2);
          }
          resolve(distinct.unique());
        }, reject);
      });
    },

    getProduct : function(shopifyId){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'products/' + shopifyId + '.json').then(function(body){
          resolve(body.product);
        }, reject);
      });
    },

    getVariant : function(shopifyId){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'variants/' + shopifyId + '.json').then(function(body){
          resolve(body.variant);
        }, reject);
      });
    },

    getAllProducts : function(){
      return new Promise(function(resolve, reject){
        doCallout('GET', 'products.json?limit=250').then(function(body){
          resolve(body.products);
        }, reject);
      });

    },

    deleteVariant : function(productId, variantId){
      var productModule = require('../modules/product')(utils, conn);
      return new Promise(function(resolve, reject){
        doCallout('DELETE', 'products/' + productId + '/variants/' + variantId + '.json').then(function(body){
          productModule.deleteProduct(variantId).then(resolve, reject);
        }, reject);
      })
    }
  }
};
