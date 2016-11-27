var express = require('express')
  , router = express.Router()
  , Order = require('../models/order');

router.post('/', function(req, res){
  Order.create(req.body).then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  })
})

router.post('/LineItem', function(req, res){
  var conn = res.locals.connection;
  conn.sobject("Apttus_Config2__OrderLineItem__c").create(req.body, function(err, ret){
    if(!err)
      res.status(200).send(ret);
    else
      res.status(400).send(err);
  })
})

router.delete('/LineItem/:id', function(req, res){
  var conn = res.locals.connection;
  conn.sobject("Apttus_Config2__OrderLineItem__c").destroy(req.params.id, function(err, ret){
    if(!err)
      res.status(200).send(ret);
    else
      res.status(400).send(err);
  })
})

router.post('/Cart', function(req, res){
  var conn = res.locals.connection;
  conn.sobject("Apttus_Config2__Order__c").create(req.body, function(err, ret){
    if(!err)
      res.status(200).send(ret);
    else
      res.status(400).send(err);
  })
})

module.exports = router;
