module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);
  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  return {
    upsertProduct : function(product){
      var shopify = require('../modules/shopify')(utils);
      var imgArray = new Array();
      //Upsert the images
      for(var i in product.images){
        var img = product.images[i];
        if(img.id){
          imgArray.push({
            Image_Source__c : img.src,
            Position__c : img.position,
            Shopify_Id__c : img.id
          });
        }
      }
      var imagePromise = conn.sobject("Image__c").upsert(imgArray, "Shopify_Id__c");
      var mPromise = shopify.getProductMetafields(product.id);
      var storePromise = conn.query("SELECT Id FROM Store__c WHERE External_Id__c = '" + product.vendor.replace(/'/g, "\\'") + "'").then(function(sData){
        return new Promise(function(resolve, reject){
          if(!sData.records || sData.records.length == 0){
            conn.sobject("Store__c").create({
              Name : product.vendor,
              External_Id__c : product.vendor
            }, function(scErr, scRet){
              if(scErr)
                reject(scErr)
              else
                resolve(scRet);
            });
          }else
            resolve();
        })
      });

      return Promise.all([imagePromise, mPromise, storePromise]).then(function(results){
          var p = {
            Body_Html__c : product.body_html,
            Handle__c : product.handle,
            Shopify_Id__c : product.id,
            Family : product.product_type,
            Publish_Scope__c : product.published_scope,
            Published_At__c : product.published_at,
            Tags__c : product.tags,
            Name : product.title,
            Brand__c : shopify.metaFilter(results[1].metafields, 'brand'),
            IsActive : true,
            Store__r : {External_Id__c : product.vendor},
          };
          if(product.image)
            p.Image__r = {Shopify_Id__c : product.image.id};

          return conn.sobject("Product2").upsert(p, 'Shopify_Id__c');
        }).then(function(){
          //upsert the options
          var optionPromise = new Promise(function(resolve, reject){
            var optionArray = new Array();

            for(var i in product.options){
              var option = product.options[i];
              if(option && option.values){
                optionArray.push({
                  Shopify_Id__c : option.id,
                  Name : option.name,
                  Position__c : option.position,
                  Values__c : option.values.join(", ")
                })
              }
            }
            conn.sobject("Option__c").upsert(optionArray, 'Shopify_Id__c', function(err, rets){
              if(err)
                reject(err);
              else
                resolve(rets);
            });
          });

          var recordTypePromise = new Promise(function(resolve, reject){
            conn.query("SELECT Id FROM RecordType WHERE (DeveloperName = 'Variant' AND SobjectType = 'Product2')", function(rErr, data){
              if(rErr)
                reject(rErr);
              else
                resolve(data);
            });
          });
          var variantPromise = new Promise(function(resolve, reject){
            var variantPromiseList = new Array();
            for(var i in product.variants){
              variantPromiseList.push(shopify.getVariantMetafields(product.variants[i].id));
            }
            Promise.all(variantPromiseList).then(resolve, reject);
          });

          return Promise.all([optionPromise, recordTypePromise, variantPromise]);
        }).then(function(rets){
          var variantArray = new Array();
          for(var i in product.variants){
            var v = product.variants[i];
            var variant = {
              Name : v.title,
              Barcode__c : v.barcode,
              Fulfillment_Service__c : v.fulfillment_service,
              Family : product.product_type,
              Body_Html__c : product.body_html,
              grams__c : v.grams,
              Handle__c : product.handle,
              IsActive : true,
              Shopify_Id__c : v.id,
              Inventory_Quantity__c : v.inventory_quantity,
              Old_Inventory_Quantity__c : v.old_inventory_quantity,
              Requires_Shipping__c : v.requires_shipping,
              SKU__c : v.sku,
              Tags__c : product.tags,
              Taxable__c : v.taxable,
              Weight__c : v.weight,
              Weight_Unit__c : v.weight_unit,
              Store__r : {External_Id__c : product.vendor},
              Parent_Product__r : {Shopify_Id__c : v.product_id},
              RecordTypeId : rets[1].records[0].Id
            }

            if(v.image_id)
              variant.Image__r = {Shopify_Id__c : v.image_id};

            variantArray.push(variant);
          }
          return conn.sobject("Product2").upsert(variantArray, 'Shopify_Id__c').then(function(){
            //Upsert the variant options and price book entries
            var variantArray = new Array();
            var pbeList = new Array();
            for(var i in product.variants){
              var v = product.variants[i];
              if(v.option1)
              variantArray.push({
                Option__r : {Shopify_Id__c : product.options[0].id},
                Product__r : {Shopify_Id__c : v.id},
                Shopify_Id__c : product.options[0].id + ':' + v.id,
                Value__c : v.option1
              });
              if(v.option2)
              variantArray.push({
                Option__r : {Shopify_Id__c : product.options[1].id},
                Product__r : {Shopify_Id__c : v.id},
                Shopify_Id__c : product.options[1].id + ':' + v.id,
                Value__c : v.option2
              });
              if(v.option3)
              variantArray.push({
                Option__r : {Shopify_Id__c : product.options[2].id},
                Product__r : {Shopify_Id__c : v.id},
                Shopify_Id__c : product.options[2].id + ':' + v.id,
                Value__c : v.option3
              });
              var metaList = rets[2].filter(function(obj){
                return obj.variantId == v.id
              })[0];

              var metaprice = shopify.metaFilter(metaList.metafields.metafields, 'metalistpricecurrent');
              pbeList.push({
                UnitPrice : ((metaprice) ? (metaprice / 100) : metaprice),
                IsActive : true,
                External_Id__c : v.id + ':standard',
                Product2 : {Shopify_Id__c : v.id},
                Pricebook2 : {External_Id__c : 'standard'}
              });
            }
            utils.log(pbeList);
            return conn.query("SELECT Id, External_Id__c FROM PricebookEntry WHERE Product2.Parent_Product__r.Shopify_Id__c = '" + product.id + "'").then(function(result){
              var updateRecords = new Array();
              var insertRecords = new Array();
              for(var x in pbeList.records){
                var found = false;
                for(var i in result.records){
                  if(pbeList[x].External_Id__c == result.records[i].External_Id__c){
                    delete pbeList[x].Product2;
                    delete pbeList[x].Pricebook2;
                    updateRecords.push(pbeList[x]);
                    found = true;
                  }
                }
                if(!found)
                  insertRecords.push(pbeList[x]);
              }
              return conn.sobject("PricebookEntry").update(updateRecords, 'External_Id__c').then(conn.sobject("PricebookEntry").create(insertRecords));
            }).then(function(){
              return new Promise(function(resolve, reject){
                conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c').then(resolve, function(err){
                  if(err && err.errorCode == "INVALID_FIELD_FOR_INSERT_UPDATE"){
                    for(var x in variantArray){
                      delete variantArray[x].Option__r;
                    }
                    conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c').then(resolve, reject);
                  }
                })
              })
            });
          });
        });
      },

    deleteProduct : function(productId){
      return conn.query("SELECT Id FROM Product2 WHERE Shopify_Id__c = '" + productId + "' OR Parent_Product__r.Shopify_Id__c = '" + productId + "'").then(
        function(result){
          for(var i in result.records){
            result.records[i].IsActive = false;
          }
          return conn.sobject("Product2").update(result.records);
        }
      );
    }
  }

};
