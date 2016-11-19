var jsforce = require('jsforce')
  , jwtflow = require('salesforce-jwt')
  , conn = new jsforce.Connection();


module.exports = {
  authenticate : function(req, res, next){
    var clientId = '3MVG9szVa2RxsqBaX8xtHFh8G0Xa7QGjNAztSXVtK4YBMNQ18dwQW5aIA3kt94mBlUu_XvSMdKXZi25wPOAzV';
    var privateKey = require('fs').readFileSync('./certs/PrivateKey.key', 'utf8');
    var instanceUrl = 'https://na35.salesforce.com';

    jwtflow.getToken(clientId, privateKey, 'ejgallowineryincv11.3@apttusdemo.com', function(err, accessToken){
      if(!err && accessToken){
        conn.initialize({
          instanceUrl: instanceUrl,
          accessToken: accessToken
        });
        next();
      }else{
        res.status(401).send();
      }
    });

    // conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD, function(err, userInfo){
    //   if(err)
    //     res.status(401).send();
    //   else
    //     next();
    // });
  },
  getConnection : function(){
    return conn;
  }
}
