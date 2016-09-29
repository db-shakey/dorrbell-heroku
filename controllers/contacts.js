var express = require('express')
  , router = express.Router()
  , Contact = require('../models/contact')
  , conn = require('../middlewares/salesforce');

router.get('/', function(req, res){
  Contact.all().then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  });
}) 

module.exports = router;
