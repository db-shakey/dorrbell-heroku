var express = require('express')
  , router = express.Router()
  , Product = require('../models/product')
  , fs = require('fs')
  , jsforce = require('jsforce')
  , conn = new jsforce.Connection();

router.get('/', function(req, res){
  Product.all().then(function(data){
    res.status(200).send(data);
  }, function(err){
    res.status(400).send(err);
  })
})

router.post('/attachment/:attachmentId', function(req, res){
  if(req.params.attachmentId && req.body.authToken && req.body.instanceUrl){
    conn.initialize({
      instanceUrl: req.body.instanceUrl,
      accessToken: req.body.authToken
    });
    var path = 'public/images/' + req.params.attachmentId + '.png';
    var fileOut = fs.createWriteStream(path, {flags : 'w', autoClose : true});
    fileOut.on("error", function(err){console.log(err);})
    var file = conn.sobject('Attachment').record(req.params.attachmentId).blob('Body').pipe(fileOut);
    res.status(200).send({uri : path.substring(path.indexOf('/'))});
  }
})

module.exports = router;
