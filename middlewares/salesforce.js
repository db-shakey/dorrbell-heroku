var jsforce = require('jsforce')
  , jwtflow = require('salesforce-jwt')
  , conn = new jsforce.Connection();


module.exports = {
  authenticate : function(req, res, next){
    if(req.get('x-access-token') && req.get('x-instance-url')){
      conn.initialize({
        instanceUrl: req.get('x-instance-url'),
        accessToken: req.get('x-access-token')
      });
      res.locals.connection = conn;
      next();
    }else
      res.status(400).send('Unauthorized');
  },

  getConnection : function(){
    return conn;
  }
}
