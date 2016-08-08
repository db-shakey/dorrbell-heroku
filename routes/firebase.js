module.exports = function(routes, utils, conn){
  var path = require('path');
  var excludeFields = ['LastModifiedDate', 'OrderNumber', 'CreatedById', 'IsDeleted', 'IsReductionOrder', 'Return_Shopping_Assistant_Phone__c',
                      'CreatedDate', 'Delivery_Shopping_Assistant_Phone__c', 'TotalAmount', 'SystemModstamp', 'LastModifiedById', 'attributes', 'LastViewedDate', 'LastReferencedDate', 'Name', 'Cart_Items__c'];

  var watchers = {
    'Carts__r' : {
      externalId : 'Shopify_Id__c',
      sObject : 'Cart__c'
    },
    'Events' : {
      sObject : 'Event'
    }
  }
  var lockRecords = [];
  /**************
   * Firebase Server
   *************/
  var firebase = require('firebase');
  firebase.initializeApp({
    serviceAccount: process.env.firebaseCredentials,
    databaseURL: process.env.firebaseUrl,
    databaseAuthVariableOverride: {
      uid: "my-service-worker"
    }
  });
  var db = firebase.database();


  // db.ref('customers').once('child_changed', function(data){
  //   for(var i in watchers){
  //     db.ref('customers/' + data.key + '/contact/' + i + '/records').on('child_added', function(inst){
  //       var obj = inst.val();
  //       var key = inst.ref.parent.parent.key;
  //       if(obj){
  //         if(obj.Id)
  //           delete obj.Id;
  //         for(var x = 0; x<excludeFields.length; x++){
  //           delete obj[excludeFields[x]];
  //         }
  //         if(data && data.key && lockRecords.indexOf(data.key) < 0){
  //           if(watchers[key].externalId){
  //             conn.sobject(watchers[key].sObject).upsert(obj, watchers[key].externalId).then(function(res){utils.log(res);}, function(err){utils.log(err);});
  //           }else{
  //             conn.sobject(watchers[key].sObject).create(obj).then(function(res){utils.log(res);}, function(err){utils.log(err);});
  //           }
  //         }
  //       }
  //     })
  //   }
  // });

  db.ref('customers').on("value", function(c){
    c.forEach(function(data){
      unlockRecord(data.key);
    });
  })

  var lockRecord = function(key){
    utils.log('locking record' + key);
    lockRecords.push(key);
    setTimeout(function(){unlockRecord(key);}, 5000);
  }

  var unlockRecord = function(key){
    if(lockRecords.indexOf(key) > -1){
      utils.log('unlocking record' + key);
      lockRecords.splice(lockRecords.indexOf(key), 1);
    }
  }

  routes.post('/fb/customers', function(req, res){
    lockRecord(req.body.firebaseId);

    var ref = db.ref('customers');

    var obj = {};
    obj[req.body.firebaseId] = req.body;
    if(!db.ref('customers/' + req.body.firebaseId))
      ref.set(obj);
    else
      ref.update(obj);

    res.status(200).send();
  });

  routes.post('/fb/retailers', function(req, res){
    utils.log(req.body);
    var ref = db.ref('retailers');
    var obj = {};
    for(var i = 0; i<req.body.length; i++){
      obj[req.body[i].Id] = req.body[i];
    }
    ref.set(obj);
  });

  routes.delete('/fb/customers', function(req, res){
    lockRecord(req.body.firebaseId);

    var ref = db.ref('customers');
    ref.child(req.body.firebaseId).remove();
    res.status(200).send();
  });

  routes.post('/fb/locations', function(req, res){
    var obj = {};
    for(var i = 0; i<req.body.length; i++){
      obj[req.body[i].Postal_Code__c] = req.body[i];
    }

    if(!db.ref('locations'))
      db.ref('locations').set(obj);
    else
      db.ref('locations').update(obj);
  });

  routes.delete('/fb/locations', function(req, res){
    var ref = db.ref('locations');
    ref.child(req.body.Id).remove();
    res.status(200).send();
  });

  return routes;
};
