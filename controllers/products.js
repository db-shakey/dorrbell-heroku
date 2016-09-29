var express = require('express')
  , router = express.Router()
  , Product = require('../models/product')
  , conn = require('../middlewares/salesforce');

router.get('/', function(req, res){
  Product.all().then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  })
})

module.exports = router;
