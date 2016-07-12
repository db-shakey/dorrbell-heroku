module.exports = function(routes, utils, conn){
  var path = require('path');
  var excludeFields = ['LastModifiedDate', 'OrderNumber', 'CreatedById', 'IsDeleted', 'IsReductionOrder', 'Return_Shopping_Assistant_Phone__c',
                      'CreatedDate', 'Delivery_Shopping_Assistant_Phone__c', 'TotalAmount', 'SystemModstamp', 'LastModifiedById', 'attributes'];

  /**************
   * Firebase Server
   *************/
  var firebase = require('firebase');
  firebase.initializeApp({
    serviceAccount: './certs/dorrbell-firebase.json',
    databaseURL: "https://dorrbell-1106.firebaseio.com/",
    databaseAuthVariableOverride: {
      uid: "my-service-worker"
    }
  });
  var db = firebase.database();

  // var ref = db.ref();
  // ref.orderByKey().on("child_added", function(sObject){
  //   ref.child(sObject.key).on("child_changed", function(record){
  //     var data = record.val();
  //     var type = data.attributes.type;
  //
  //     for(var i in data){
  //       if(excludeFields.indexOf(i) > -1)
  //         delete data[i];
  //     }
  //
  //     var onError = function(err){
  //       if(err.fields){
  //         for(var i in data){
  //           if(err.fields.indexOf(i) > -1)
  //             delete data[i];
  //         }
  //         console.log(err.fields);
  //         conn.sobject(type).update(data).then(onSuccess, onError);
  //       }else{
  //         console.log(err);
  //       }
  //     }
  //     conn.sobject(type).update(data).then(function(res){}, onError);
  //   })
  // })

  routes.post('/sobject', function(req, res){
    utils.log(req.body);
    var ref = db.ref();

    var obj = {};
    obj[req.body.firebaseId] = req.body;
    if(!db.ref(req.body.firebaseId))
      ref.set(obj);
    else
      ref.update(obj);

    res.status(200).send();
  })

  routes.delete('/sobject', function(req, res){
    var ref = db.ref('/' + req.body.firebaseId);
    var objList = {};
    var firebaseId = ;
    ref.remove();
    res.status(200).send();
  })

  return routes;
};
