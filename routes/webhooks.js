module.exports = function(route, conn, utils){


  /**************************
	 * Product
	 *************************/
  route.post('/product/:route', function(req, res){
    var errorHandler = function(err){
      utils.log(err);
      res.status(200).send();
    }
    var product = req.body;
    utils.log(product);
    var route = req.params.route;
    var shopify = require('./shopify')(utils);

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
          utils.log(metaprice);
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
          conn.sobject("PricebookEntry").upsert(pbeList, 'External_Id__c', function(err){if(err) errorHandler(err);});
        });
        utils.log(variantArray);
        conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c', function(err){if(err) errorHandler(err);});
      });
    }, errorHandler);

  })

  /**************************
	 * Order
	 *************************/
	route.post('/order/:route', function(req, res){
    var order = req.body;
    utils.log(order);
    var route = req.params.route;
    var shopify = require('./shopify')(utils);
    var google = require('./google')(utils);

    //Upsert customer first
    conn.sobject("Contact").upsert({
      MailingStreet : order.customer.default_address.address1,
      MailingCity : order.customer.default_address.city,
      MailingCountry : order.customer.default_address.country_code,
      MailingPostalCode : order.customer.default_address.zip,
      MailingState : order.customer.default_address.province_code,
      Email : order.customer.email,
      Shopify_Customer_ID__c : order.customer.id,
      FirstName : order.customer.first_name,
      LastName : order.customer.last_name,
      MobilePhone : order.customer.default_address.phone,
      Status__c : order.customer.state,
      HasOptedOutOfEmail : !order.customer.accepts_marketing,
      Email_Verified__c : order.customer.verified_email,
      Total_Spent__c : order.customer.total_spent,
      Tax_Exempt__c : order.customer.tax_exempt
    }, 'Shopify_Customer_ID__c', function(err, ret){
      if(err)
        utils.log(err);
      else{
        new Promise(function(resolve, reject){
          var sfOrder = {
            BillingStreet : order.billing_address.address1,
            BillingCity : order.billing_address.city,
            BillingState : order.billing_address.province,
            BillingCountry : order.billing_address.country,
            BillingPostalCode : order.billing_address.zip,
            BillingLatitude : order.billing_address.latitude,
            BillingLongitude : order.billing_address.longitude,
            ShippingStreet : order.shipping_address.address1,
            ShippingCity : order.shipping_address.city,
            ShippingState : order.shipping_address.province,
            ShippingCountry : order.shipping_address.country,
            ShippingPostalCode : order.shipping_address.zip,
            ShippingLatitude : order.shipping_address.latitude,
            ShippingLongitude : order.shipping_address.longitude,
            Browser_IP__c : order.browser_ip,
            Accepts_Marketing__c : order.buyer_accepts_marketing,
            Cart_Token__c : order.cart_token,
            Checkout_Id__c : order.checkout_id,
            Checkout_Token__c : order.checkout_token,
            Browser_User_Agent__c : (order.client_details) ? order.client_details.user_agent : null,
            Browser_Width__c : (order.client_details) ? order.client_details.browser_width : null,
            Browser_Height__c : (order.client_details) ? order.client_details.browser_height : null,
            Confirmed__c : order.confirmed,
            Shopify_Id__c : order.id,
            Account : {External_Id__c : 'Shopify'},
            Status : 'Draft',
            Status__c : 'New',
            EffectiveDate : order.created_at,
            Financial_Status__c : order.financial_status,
            Fulfillment_Status__c : order.fulfillment_status,
            Number__c : order.number,
            Name : order.order_number,
            Token__c : order.token,
            Total_Weight__c : order.total_weight,
            Note__c : order.note,
            Pricebook2 : {External_Id__c : 'standard'}
          };
          if(order.customer && order.customer.id){
            sfOrder.BillToContact = {Shopify_Customer_ID__c : order.customer.id};
            sfOrder.ShipToContact = {Shopify_Customer_ID__c : order.customer.id};
          }

          if(order.payment_details){
            sfOrder.Credit_Card_Bin__c = order.payment_details.credit_card_bin;
            sfOrder.Credit_Card_Company__c = order.payment_details.credit_card_company;
            sfOrder.Credit_Card_Number__c = order.payment_details.credit_card_number;
            sfOrder.CVV_Result_Code__c = order.payment_details.cvv_result_code;
          }

          var zeroPad = function(num, places) {
              var zero = places - num.toString().length + 1;
              return Array(+(zero > 0 && zero)).join("0") + num;
          }
          var inHomeTryOnStart;
          var inHomeTryOnEnd;
          if(order.note_attributes){
            Date.prototype.normalize = function(){
              return new Date(this - this.getTimezoneOffset() * 60000);
            }



            for(var i in order.note_attributes){
              var n = order.note_attributes[i];
              if(n.name == "request_additional_items")
                sfOrder.Request_Additional_Items__c = (n.value.toLowerCase() == "yes") ? true : false
              else if(n.name == "local_delivery_request"){
                var deliveryTime = n.value.replace(/\s+/g,' ').trim();
                var sList = deliveryTime.split(" ");
                if(sList[6] == "PM")
                  sList[5] = (Number(sList[5].substring(0,sList[5].indexOf(':'))) + 12) + sList[5].substring(sList[5].indexOf(':'));

                if(sList[9] == "PM")
                  sList[8] = (Number(sList[8].substring(0,sList[8].indexOf(':'))) + 12)  + sList[8].substring(sList[8].indexOf(':'));

                utils.log(sList);

                inHomeTryOnStart = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[5] + ":00");
                inHomeTryOnEnd = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[8] + ":00");


              }
            }
          }
          google.getTimezoneOffset(ShippingLatitude, ShippingLongitude).then(function(tz){
              var offset = tz.rawOffset * -1;
              inHomeTryOnStart.setUTCSeconds(offset);
              inHomeTryOnEnd.setUTCSeconds(offset);

              sfOrder.In_Home_Try_On_Start__c = (inHomeTryOnStart.getYear() + 1900) + '-' + zeroPad(inHomeTryOnStart.getMonth(), 2) + '-' + zeroPad(inHomeTryOnStart.getDay(), 2) + 'T' + zeroPad(inHomeTryOnStart.getHours(), 2) + ':' + zeroPad(inHomeTryOnStart.getMinutes(), 2) + ':' + zeroPad(inHomeTryOnStart.getSeconds(), 2) + 'Z';
              sfOrder.In_Home_Try_On_End__c = (inHomeTryOnEnd.getYear() + 1900) + '-' + zeroPad(inHomeTryOnEnd.getMonth(), 2) + '-' + zeroPad(inHomeTryOnEnd.getDay(), 2) + 'T' + zeroPad(inHomeTryOnEnd.getHours(), 2) + ':' + zeroPad(inHomeTryOnEnd.getMinutes(), 2) + ':' + zeroPad(inHomeTryOnEnd.getSeconds(), 2) + 'Z';

              conn.sobject("Order").upsert(sfOrder, 'Shopify_Id__c', function(err, ret){
                if(err){
                  reject(err);
                }else
                  resolve(ret);
              });
          });

        }).then(function(){
          var orderProductList = new Array();
          var orderStoreList = new Array();
          var metaArray = new Array();
          for(var i in order.line_items){
            var li = order.line_items[i];
            metaArray.push(shopify.getVariantMetafields(li.variant_id));
          }

          Promise.all(metaArray).then(function(metadata){
            for(var i in order.line_items){
              var li = order.line_items[i];
              if(li.variant_id){
                var metaList = metadata.filter(function(obj){
                  return obj.variantId == li.variant_id
                })[0];
                var metaprice = shopify.metaFilter(metaList.metafields.metafields, 'metaprice');

                orderProductList.push({
                  Quantity : li.quantity,
                  UnitPrice : ((metaprice) ? (metaprice / 100) : metaprice),
                  Shopify_Id__c : li.id,
                  Description : li.name,
                  Order_Store__r : {External_Id__c : order.id + ':' + li.vendor},
                  Status__c : 'Requested',
                  PricebookEntry : {External_Id__c : li.variant_id + ':standard'},
                  Order : {Shopify_Id__c : order.id}
                });

                //Create the order store
                orderStoreList.push({
                  Order__r : {Shopify_Id__c : order.id},
                  Store__r : {External_Id__c : li.vendor},
                  External_Id__c : order.id + ':' + li.vendor,
                  Status__c : 'New'
                });
              }
            }
            conn.sobject("Order_Store__c").upsert(orderStoreList, 'External_Id__c', function(err, ret){
              if(err && err.name != 'INVALID_FIELD_FOR_INSERT_UPDATE')
                utils.log(err);
              else {
                conn.sobject("OrderItem").upsert(orderProductList, 'Shopify_Id__c', function(err, ret){
                  if(err && err.errorCode == 'INVALID_FIELD_FOR_INSERT_UPDATE'){
                    for(var i in orderProductList){
                      var p = orderProductList[i];
                      delete p.PricebookEntry;
                      delete p.Order;
                    }
                    conn.sobject("OrderItem").upsert(orderProductList, 'Shopify_Id__c', function(a,b){res.status(200).send()});
                  }else
                    res.status(200).send();
                });
              }
            });
          });



          //Populate the transaction information
          shopify.getTransactionsForOrder(order.id).then(function(results){
            var tArray = new Array();
            for(var i in results.transactions){
              var t = results.transactions[i];
              tArray.push({
                Order__r : {Shopify_Id__c : order.id},
                Amount__c : t.amount,
                Authorization__c : t.authorization,
                Currency__c : t.currency,
                Kind__c : t.kind,
                Message__c : t.message,
                Shopify_Id__c : t.id,
                Status__c : t.status
              });
            }
            conn.sobject("Order_Transaction__c").upsert(tArray, 'Shopify_Id__c', function(err, ret){});
          })



        }, function(err){
          utils.log(err);
        })
      }
    });
    res.status(200).send();
  });


  /**************************
	 * Customer
	 *************************/
  route.post('/customer/:route', function(req, res){
    var route = req.params.route;
    var contact = req.body;
    var defaultAddress = (contact.default_address) ? contact.default_address : {};

    if(route == 'delete'){
      conn.sobject("Contact").upsert({
        Shopify_Customer_ID__c : contact.id,
        Status__c : 'deleted'
      }, 'Shopify_Customer_ID__c', function(err, ret){
        if(err)
          utils.log(err);
        else
          res.status(200).send();
      });
    }else{
      conn.sobject("Contact").upsert({
        MailingStreet : defaultAddress.address1,
        MailingCity : defaultAddress.city,
        MailingCountry : defaultAddress.country,
        MailingPostalCode : defaultAddress.zip,
        MailingState : defaultAddress.province,
        Email : contact.email,
        Shopify_Customer_ID__c : contact.id,
        FirstName : contact.first_name,
        LastName : contact.last_name,
        Status__c : contact.state,
        MobilePhone : order.customer.default_address.phone,
        HasOptedOutOfEmail : !contact.accepts_marketing,
        Email_Verified__c : contact.verified_email,
        Total_Spent__c : contact.total_spent,
        Tax_Exempt__c : contact.tax_exempt
      }, 'Shopify_Customer_ID__c', function(err, ret){
        if(err)
          utils.log(err);
        else
          res.status(200).send();
      });
    }
  });

};