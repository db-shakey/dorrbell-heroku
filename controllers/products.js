var express = require('express')
  , router = express.Router()
  , Product = require('../models/product')
  , fs = require('fs')
  , jsforce = require('jsforce');

router.get('/', function(req, res){
  Product.all().then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  })
})

router.get('/attachment/:attachmentId', function(req, res){
  if(req.params.attachmentId){
    var conn = res.locals.connection;
    var path = 'public/images/' + req.params.attachmentId + '.png';
    var fileOut = fs.createWriteStream(path, {flags : 'w', autoClose : true});
    fileOut.on("error", function(err){console.log(err);})
    fileOut.on('finish', function(){
        res.status(200).send({uri : path.substring(path.indexOf('/'))});
    })
    var file = conn.sobject('Attachment').record(req.params.attachmentId).blob('Body').pipe(fileOut);
  }
})

module.exports = router;
