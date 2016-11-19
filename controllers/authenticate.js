var express = require('express')
  , jwtflow = require('salesforce-jwt')
  , router = express.Router();

router.post('/login', function(req, res){
  var username = req.body.username;

  var clientId = '3MVG9szVa2RxsqBaX8xtHFh8G0Xa7QGjNAztSXVtK4YBMNQ18dwQW5aIA3kt94mBlUu_XvSMdKXZi25wPOAzV';
  var privateKey = require('fs').readFileSync('./certs/PrivateKey.key', 'utf8');

  jwtflow.getToken(clientId, privateKey, username, function(err, accessToken){
    if(!err && accessToken){
      res.status(200).send({
        accessToken : accessToken
      });
    }else{
      res.status(401).send();
    }
  });
})

module.exports = router;
