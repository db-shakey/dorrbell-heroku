var express 		  = require('express');
var jwt    			  = require('jsonwebtoken');
var fs 				    = require('fs');
var Knex 			    = require('knex');
var cookieParser 	= require('cookie-parser');
var bodyParser 		= require('body-parser');
var session 		  = require('express-session');
var cors 			    = require('cors');
var jsforce       = require('jsforce');
var crypto        = require('crypto');
var http          = require('http');
var https         = require('https');

//Main app
var app = express();

app.set('port', (process.env.PORT || 5000));


app.use(cors());
app.use(bodyParser.json());

var apiRoutes = express.Router();
var conn = new jsforce.Connection();
var socketServer;

conn.login('shakey@dorrbell.com', 'Seketha2sVlB3TJ2VP30V8Y3AF2eL7YgW', function(err, res){
  if(err){return console.error(err);}
});



var utils = require('./utils/app-utils')(crypto, jwt);



apiRoutes.post('/error', function(req, res){
  conn.sobject('Mobile_Error__c').create([
    req.body
  ], function(err, rets){
    if (err) { 
      res.status(401).send(err); 
    }
    for (var i=0; i < rets.length; i++) {
      if (!rets[i].success) {
        res.status(401).send("Fail");
      }
    }
    res.status(200).send("Ok");
  });
});

//authenticate requests
apiRoutes.use(function(req, res, next){
  if(utils.checkToken(req))
    next();
  else{
    return res.status(403).send({
      success : false,
      message : 'Unauthorized Application'
    });
  }
})

require('./routes/unauthenticated')(apiRoutes, conn, utils);

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, utils.getPassword(), function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;    
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

var authPath = require('./routes/authenticated')(apiRoutes, conn);

app.use('/api', apiRoutes);

var httpServer = http.createServer(app).listen(app.get('port'), function(){
  console.log("Dorrbell standard listening on port " + app.get('port'));
});

var io = require('socket.io')(httpServer);
io.on("connection", function(socket){
  socket.on("update", function(data){
    socket.broadcast.emit("update", data);
  })
})



https.createServer({
  key : fs.readFileSync('./certs/mykey.pem'),
  cert : fs.readFileSync('./certs/mycert.pem'),
  ca : fs.readFileSync('./certs/ca.key'),
  requestCert : false,
  rejectUnauthorized : false
}, app).listen(8443, function(){
  console.log("Dorrbell secure listening on port 443");
});







