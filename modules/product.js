module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);
  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  return {
    upsertProduct : function(product, response){
      //upsert the images
      var productPromise = new Promise(function(resolve, reject){
        var iPromise = new Promise(function(iR, iJ){
          var imgArray = new Array();
          for(var i in product.images){
            var img = product.images[i];
            imgArray.push({
              Image_Source__c : img.src,
              Position__c : img.position,
              Shopify_Id__c : img.id
            });
          }

          conn.sobject("Image__c").upsert(imgArray, 'Shopify_Id__c', function(err, rets){
            if(err) iJ(err);
            else iR(rets);
          });
        });

        var mPromise = shopify.getProductMetafields(product.id);

        var sPromise = new Promise(function(sR, sJ){
        utils.log(product);
          conn.query("SELECT Id FROM Store__c WHERE External_Id__c = '" + product.vendor + "'", function(sErr, sData){
            if(sErr || !sData.records || sData.records.length == 0){
              conn.sobject("Store__c").create({
                Name : product.vendor,
                External_Id__c : product.vendor
              }, function(scErr, scRet){
                if(scErr)
                  sJ(scErr)
                else
                  sR(scRet);
              });
            }else
              sR();
          })
        })

        Promise.all([iPromise, mPromise, sPromise]).then(function(results){
          var p = {
            Body_Html__c : product.body_html,
            Handle__c : product.handle,
            Shopify_Id__c : product.id,
            Family : product.product_type,
            Publish_Scope__c : product.published_scope,
            Tags__c : product.tags,
            Name : product.title,
            Brand__c : shopify.metaFilter(results[1].metafields, 'brand'),
            IsActive : true,
            Store__r : {External_Id__c : product.vendor},
          };
          if(product.image)
            p.Image__r = {Shopify_Id__c : product.image.id};

          conn.sobject("Product2").upsert(p, 'Shopify_Id__c', function(err, rets){
            if(err)
              reject(err);
            else
              resolve(rets);
          });
        }, function(err){
          utils.log(err);
        });

      });

      //upsert the options
      var optionPromise = new Promise(function(resolve, reject){
        var optionArray = new Array();
        for(var i in product.options){
          var option = product.options[i];
          optionArray.push({
            Shopify_Id__c : option.id,
            Name : option.name,
            Position__c : option.position,
            Values__c : option.values.join(", ")
          })
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

      Promise.all([productPromise, optionPromise, recordTypePromise, variantPromise]).then(function(rets){
        var recordTypeId = rets[2].records[0].Id;
        //Upsert the product variants
        new Promise(function(resolve, reject){
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
              RecordTypeId : recordTypeId
            }

            if(v.image_id)
              variant.Image__r = {Shopify_Id__c : v.image_id};

            variantArray.push(variant);
          }
          conn.sobject("Product2").upsert(variantArray, 'Shopify_Id__c', function(err, rets){
            if(err)
              reject(err);
            else resolve(rets);
          });
        })


        .then(function(){
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
            var metaList = rets[3].filter(function(obj){
              return obj.variantId == v.id
            })[0];

            var metaprice = shopify.metaFilter(metaList.metafields.metafields, 'metalistpricecurrent');
            var pbe = {
              UnitPrice : ((metaprice) ? (metaprice / 100) : metaprice),
              IsActive : true,
              External_Id__c : v.id + ':standard',
              Product2 : {Shopify_Id__c : v.id},
              Pricebook2 : {External_Id__c : 'standard'}
            }

            pbeList.push(pbe);
          }

          conn.query("SELECT Id, External_Id__c FROM PricebookEntry WHERE Product2.Parent_Product__r.Shopify_Id__c = '" + product.id + "'", function(err, result){
            var idList = new Array();
            for(var i in result.records){
              for(var x in pbeList){
                if(pbeList[x].External_Id__c == result.records[i].External_Id__c){
                  delete pbeList[x].Product2;
                  delete pbeList[x].Pricebook2;
                }
              };
            }
            conn.sobject("PricebookEntry").upsert(pbeList, 'External_Id__c', function(err){if(err) errorHandler(err, response);});
          });
          conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c', function(err){if(err) errorHandler(err, response);});
        });
      }, errorHandler);
      response.status(200).send("Ok");
    },

    deleteProduct : function(product, response){
      conn.query("SELECT Id FROM Product2 WHERE Shopify_Id__c = '" + product.id + "' OR Parent_Product__r.Shopify_Id__c = '" + product.id + "'", function(err, result){
        if(err)
          errorHandler(err, response);
        else{
          for(var i in result.records){
            result.records[i].IsActive = false;
          }

          conn.sobject("Product2").update(result.records, function(updateError, updateResult){
            if(updateError)
              errorHandler(updateError);
            else
              response.status(200).send("Ok");
          });
        }
      });
    }
  }

};
