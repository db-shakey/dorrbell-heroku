var jsforce = require('jsforce')
  , conn = new jsforce.Connection();


module.exports = {
  authenticate : function(req, res, next){
    conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD, function(err, userInfo){
      if(err)
        res.status(401).end();
      else
        next();
    });
  },
  getConnection : function(){
    return conn;
  }
}
