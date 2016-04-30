module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);

  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  var zeroPad = function(num, places) {
      var zero = places - num.toString().length + 1;
      return Array(+(zero > 0 && zero)).join("0") + num;
  }

  var findDeliveryWindow = function(order){
    var google = require('./google')(utils);
    var p = new Promise(function(resolve, reject){
      var inHomeTryOnStart;
      var inHomeTryOnEnd;
      var timeWindows = {};

      for(var i in order.note_attributes){
        var n = order.note_attributes[i];
        if(n.name == "local_delivery_request"){
          var deliveryTime = n.value.replace(/\s+/g,' ').trim();
          var sList = deliveryTime.split(" ");
          if(sList[6] == "PM" && sList[5] != "12:00")
            sList[5] = (Number(sList[5].substring(0,sList[5].indexOf(':'))) + 12) + sList[5].substring(sList[5].indexOf(':'));

          if(sList[9] == "PM" && sList[8] != "12:00")
            sList[8] = (Number(sList[8].substring(0,sList[8].indexOf(':'))) + 12)  + sList[8].substring(sList[8].indexOf(':'));


          inHomeTryOnStart = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[5] + ":00");
          inHomeTryOnEnd = new Date(sList[1] + " " + sList[2] + ", " + sList[3] + " " + sList[8] + ":00");

          timeWindows.Local_Try_On_Start__c = (inHomeTryOnStart.getMonth() + 1) + '/' + inHomeTryOnStart.getDate() + '/' + (inHomeTryOnStart.getYear() + 1900) + ' ' + deliveryTime.split(" ")[5] + ' ' + deliveryTime.split(" ")[6];
          timeWindows.Local_Try_On_End__c = (inHomeTryOnEnd.getMonth() + 1) + '/' + inHomeTryOnEnd.getDate() + '/' + (inHomeTryOnEnd.getYear() + 1900) + ' ' + deliveryTime.split(" ")[8] + ' ' + deliveryTime.split(" ")[9];
        }
      }
      google.getTimezoneOffset(order.shipping_address.latitude, order.shipping_address.longitude).then(function(tz){
        var offset = (tz.rawOffset + tz.dstOffset) * -1;

        inHomeTryOnStart.setUTCSeconds(offset);
        inHomeTryOnEnd.setUTCSeconds(offset);

        timeWindows.In_Home_Try_On_Start__c = (inHomeTryOnStart.getYear() + 1900) + '-' + zeroPad(inHomeTryOnStart.getMonth() + 1, 2) + '-' + zeroPad(inHomeTryOnStart.getDate(), 2) + 'T' + zeroPad(inHomeTryOnStart.getHours(), 2) + ':' + zeroPad(inHomeTryOnStart.getMinutes(), 2) + ':' + zeroPad(inHomeTryOnStart.getSeconds(), 2) + 'Z';
        timeWindows.In_Home_Try_On_End__c = (inHomeTryOnEnd.getYear() + 1900) + '-' + zeroPad(inHomeTryOnEnd.getMonth() + 1, 2) + '-' + zeroPad(inHomeTryOnEnd.getDate(), 2) + 'T' + zeroPad(inHomeTryOnEnd.getHours(), 2) + ':' + zeroPad(inHomeTryOnEnd.getMinutes(), 2) + ':' + zeroPad(inHomeTryOnEnd.getSeconds(), 2) + 'Z';
        resolve(timeWindows);

      }, reject);
    });

    return p;
  }


  return {
    upsertOrder : function(order){
      var shopify = require('./shopify')(utils);
      var metaArray = new Array();
      for(var i in order.line_items){
        var li = order.line_items[i];
        metaArray.push(shopify.getVariantMetafields(li.variant_id));
      }


      return Promise.all(metaArray).then(function(metadata){
        return Promise.all([findDeliveryWindow(order), shopify.getTransactionsForOrder(order.id)]).then(function(results){
          var body = {
            order : order,
            timeWindows : results[0],
            metadata : metadata,
            transactions : (results[1]) ? results[1].transactions : null
          };
          return conn.apex.post('/Order/', body);
        });
      });


    },

    deleteProduct : function(productId){

    }
  }

};
