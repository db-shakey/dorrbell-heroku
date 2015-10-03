var express 		  = require('express');
var jwt    			  = require('jsonwebtoken');
var fs 				    = require('fs');
var Knex 			    = require('knex');
var cookieParser 	= require('cookie-parser');
var bodyParser 		= require('body-parser');
var session 		  = require('express-session');
var cors 			    = require('cors')
var jsforce       = require('jsforce');


//Main app
var app = express();
app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

app.use(cors());
app.use(bodyParser.json());

var apiRoutes = express.Router();
var conn = new jsforce.Connection();

conn.login('shakey@dorrbell.com', 'Seketha2sVlB3TJ2VP30V8Y3AF2eL7YgW', function(err, res){
  if(err){return console.error(err);}
});

apiRoutes.post('/error', function(req, res){
  console.log(req);
  conn.sobject('Mobile_Error__c').create([
    req.body
  ], function(err, rets){
    if (err) { 
      console.log(err);
      res.status(401).send(err); 
    }
    for (var i=0; i < rets.length; i++) {
      if (!rets[i].success) {
        console.log(rets[i]);
        res.status(401).send("Fail");
      }
    }
    res.status(200).send("Ok");
  });
})

apiRoutes.post('/authenticate', function(req, res){
  conn.query("SELECT Id, Password__c, Email FROM Contact WHERE Email = '" + req.body.username + "'", function(err, data){
    var user = data.records[0];

    if(err || !user){
      res.status(401).json({
        success : false,
        message : 'Authentication failed. User not found'
      })
    }else if(user){
      if(user.password__c != req.body.password){
        res.status(401).json({
          success : false,
          message : 'Authentication failed. Wrong Pasword.'
        })
      }else{
        var token = jwt.sign(user, 'd00rb3ll_secret', {
          expiresInMinutes : 1440 //24 hours
        });
        res.json({
          success : true,
          message : 'Enjoy your token',
          token : token
        });
      }
    }
  });
});

// route middleware to verify a token
apiRoutes.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, 'd00rb3ll_secret', function(err, decoded) {      
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

require('./routes/authenticated')(apiRoutes, conn);

app.use('/api', apiRoutes);


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});






