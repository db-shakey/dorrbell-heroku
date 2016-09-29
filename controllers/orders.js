var express = require('express')
  , router = express.Router()
  , Order = require('../models/order')
  , conn = require('../middlewares/salesforce');

router.post('/', function(req, res){
  Order.create(req.body).then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  })
})

module.exports = router;
