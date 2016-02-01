module.exports = function(route, conn, utils){

  route.post('/product/:route', function(req, res){
    var errorHandler = function(err){
      utils.log(err);
      res.status(200).send();
    }
    //utils.log(req.body);
    var product = req.body;



    //Upsert the main product
    var mainProduct = new Promise(function(resolve, reject){
      conn.sobject("Product2").upsert({
        Body_Html__c : product.body_html,
        Handle__c : product.handle,
        Shopify_Id__c : product.id,
        Family : product.product_type,
        Publish_Scope__c : product.published_scope,
        Tags__c : product.tags,
        Name : product.title
      }, 'Shopify_Id__c', function(err, rets){if(err) reject(err); else resolve(rets);});
    });

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
      conn.sobject("Image__c").upsert(imgArray, 'Shopify_Id__c', function(err, rets){if(err) reject(err); else resolve(rets);});
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
      conn.sobject("Option__c").upsert(optionArray, 'Shopify_Id__c', function(err, rets){if(err) reject(err); else resolve(rets);});
    });

    Promise.all([mainProduct, imagePromise, optionPromise]).then(function(rets){
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
              grams__c : v.grams,
              Shopify_Id__c : v.id,
              Inventory_Quantity__c : v.inventory_quantity,
              Old_Inventory_Quantity__c : v.old_inventory_quantity,
              Requires_Shipping__c : v.requires_shipping,
              SKU__c : v.sku,
              Taxable__c : v.taxable,
              Weight__c : v.weight,
              Weight_Unit__c : v.weight_unit,
              Parent_Product__r : {Shopify_Id__c : v.product_id},
              RecordTypeId : recordTypeId
            })
          }
          conn.sobject("Product2").upsert(variantArray, 'Shopify_Id__c', function(err, rets){if(err) reject(err); else resolve(rets);});
        })


        .then(function(){
          //Upsert the product images
          var piArray = new Array();
          piArray.push({
            Image__r : {Shopify_Id__c : product.image.id},
            Product__r : {Shopify_Id__c : product.id},
            Shopify_Id__c : product.image.id + ':' + product.id
          });
          for(var i in product.variants){
            var v = product.variants[i];
            piArray.push({
              Image__r : {Shopify_Id__c : v.image_id},
              Product__r : {Shopify_Id__c : v.id},
              Shopify_Id__c : v.image_id + ':' + v.id
            })
          }
          conn.sobject("Product_Image__c").upsert(piArray, 'Shopify_Id__c', function(err){if(err) errorHandler(err);});

          //Upsert the variant options
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
            pbeList.push({
              Product2 : {Shopify_Id__c : v.id},
              Pricebook2 : {External_Id__c : 'standard'},
              UnitPrice : Number(v.compare_at_price),
              IsActive : true,
              External_Id__c : v.id + ':standard'
            });
          }
          conn.sobject("PricebookEntry").upsert(pbeList, 'External_Id__c', function(err){if(err) errorHandler(err);});
          conn.sobject("Product_Option__c").upsert(variantArray, 'Shopify_Id__c', function(err){if(err) errorHandler(err);});
        });
      });
    }, errorHandler);

  })


	route.post('/order/:route', function(req, res){

    utils.log(req.body);

    var order = req.body;

    conn.sobject("Order").create({
      BillingStreet : order.billing_address.address1,
      BillingCity : order.billing_address.city,
      BillingState : order.billing_address.province,
      BillingCountry : order.billing_address.country,
      Browser_IP__c : order.browser_ip,
      Accepts_Marketing__c : order.buyer_accepts_marketing,
      Cart_Token__c : order.cart_token,
      Checkout_Id__c : order.checkout_id,
      Checkout_Token__c : order.checkout_token,
      Browser_User_Agent__c : order.client_details.user_agent,
      Browser_Width__c : order.client_details.browser_width,
      Browser_Height__c : order.client_details.browser_height,
      Confirmed__c : order.confirmed
    });


    res.status(200).send();
  });

  route.post('/customer/:route', function(req, res){
    var route = req.params.route;
    var contact = req.body;
    var defaultAddress = (contact.default_address) ? contact.default_address : {};

    utils.log(req.body);
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
