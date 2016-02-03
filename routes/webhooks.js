module.exports = function(route, conn, utils){

  route.post('/product/:route', function(req, res){
    var errorHandler = function(err){
      utils.log(err);
      res.status(200).send();
    }
    var product = req.body;
    var route = req.params.route;

    utils.log(product);

    //upsert the images
    var imagePromise = new Promise(function(resolve, reject){
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
        if(err) reject(err);
        else {
          var p = {
            Body_Html__c : product.body_html,
            Handle__c : product.handle,
            Shopify_Id__c : product.id,
            Family : product.product_type,
            Publish_Scope__c : product.published_scope,
            Tags__c : product.tags,
            Name : product.title,
            Store__r : {External_Id__c : product.vendor},
            Image__r : {Shopify_Id__c : product.image.id}
          };
          conn.sobject("Product2").upsert(p, 'Shopify_Id__c', function(err, rets){if(err){
            reject(err);
          }  else resolve(rets);});
        }
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
      conn.sobject("Option__c").upsert(optionArray, 'Shopify_Id__c', function(err, rets){if(err){
        reject(err);
      } else resolve(rets);});
    });

    Promise.all([imagePromise, optionPromise]).then(function(rets){
      conn.query("SELECT Id FROM RecordType WHERE (DeveloperName = 'Variant' AND SobjectType = 'Product2')", function(rErr, data){
        var recordTypeId = data.records[0].Id;
        //Upsert the product variants
        new Promise(function(resolve, reject){
          var variantArray = new Array();
          for(var i in product.variants){
            var v = product.variants[i];
            variantArray.push({
              Name : v.title,
              Barcode__c : v.barcode,
              Fulfillment_Service__c : v.fulfillment_service,
              Family : product.product_type,
              Body_Html__c : product.body_html,
              grams__c : v.grams,
              Handle__c : product.handle,
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
              Image__r : {Shopify_Id__c : v.image_id},
              RecordTypeId : recordTypeId
            })
          }
          conn.sobject("Product2").upsert(variantArray, 'Shopify_Id__c', function(err, rets){if(err) reject(err); else resolve(rets);});
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
            var pbe = {
              UnitPrice : Number(v.compare_at_price),
              IsActive : true,
              External_Id__c : v.id + ':standard'
            }
            if(route == 'create'){
              pbe.Product2 = {Shopify_Id__c : v.id};
              pbe.Pricebook2 = {External_Id__c : 'standard'};
            }
            pbeList.push(pbe);
          }
          conn.sobject("PricebookEntry").upsert(pbeList, 'External_Id__c', function(err){if(err) errorHandler(err);});
          conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c', function(err){if(err) errorHandler(err);});
        });
      });
    }, errorHandler);

  })


	route.post('/order/:route', function(req, res){
    var order = req.body;
    var route = req.params.route;

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
        EffectiveDate : order.created_at,
        Financial_Status__c : order.financial_status,
        Fulfillment_Status__c : order.fulfillment_status,
        Number__c : order.number,
        Name : order.order_number,
        Token__c : order.token,
        Total_Weight__c : order.total_weight,
        Note__c : order.note,
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

      if(order.note_attributes){
        Date.prototype.normalize = function(){
          return new Date(this - this.getTimezoneOffset() * 60000);
        }

        for(var i in order.note_attributes){
          var n = order.note_attributes[i];
          if(n.name == "request_additional_items")
            sfOrder.Request_Additional_Items__c = (n.value.toLowerCase() == "yes") ? true : false
          else if(n.name == "local_delivery_request"){
            var sList =n.value.split(" ");
            if(sList[7] == "PM")
              sList[6] = (Number(sList[6].substring(0,1)) + 12) + sList[6].substring(1);

            if(sList[11] == "PM")
              sList[10] = (Number(sList[10].substring(0,1)) + 12) + sList[10].substring(1);

            sfOrder.In_Home_Try_On_Start__c = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[6] + ":00");
            sfOrder.In_Home_Try_On_End__c = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[10] + ":00");
          }
        }
      }

      if(route == 'create'){
        sfOrder.Pricebook2 = {External_Id__c : 'standard'};
      }
      conn.sobject("Order").upsert(sfOrder, 'Shopify_Id__c', function(err, ret){
        if(err)
          reject(err);
        else
          resolve(ret);
      });
    }).then(function(){
      var orderProductList = new Array();
      var orderStoreList = new Array();

      //Delete the existing order deliveries
      conn.query("SELECT Id FROM Order_Store__c WHERE Order__r.Shopify_Id__c = '" + order.id + "'", function(err, result){
        var idList = new Array();
        for(var i in result.records){
          idList.push(result.records[i].Id);
        }
        conn.sobject("Order_Store__c").del(idList, function(err, rets){
          for(var i in order.line_items){
            var li = order.line_items[i];
            if(li.variant_id){
              //Create the order item
              var orderItem = {
                Quantity : li.quantity,
                UnitPrice : li.price,
                Shopify_Id__c : li.id,
                Description : li.name,
                Order_Store__r : {External_Id__c : order.id + ':' + li.vendor}
              };
              if(route == 'create'){
                orderItem.PricebookEntry = {External_Id__c : li.variant_id + ':standard'};
                orderItem.Order = {Shopify_Id__c : order.id};
              }
              orderProductList.push(orderItem);

              //Create the order store
              orderStoreList.push({
                Order__r : {Shopify_Id__c : order.id},
                Store__r : {External_Id__c : li.vendor},
                External_Id__c : order.id + ':' + li.vendor
              });
            }
          }


          conn.sobject("Order_Store__c").upsert(orderStoreList, 'External_Id__c', function(err, ret){
            if(err && err.name != 'DUPLICATE_VALUE')
              utils.log(err);
            else {
              conn.sobject("OrderItem").upsert(orderProductList, 'Shopify_Id__c', function(err, ret){
                if(err)
                  utils.log(err);
                else {
                  res.status(200).send();
                }
              });
            }
          });
        });
      });
    }, function(err){
      utils.log(err);
    })




    res.status(200).send();
  });

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
