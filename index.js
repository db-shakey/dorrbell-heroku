var express 		= require('express');
var jwt    			= require('jsonwebtoken');
var fs 				= require('fs');
var Knex 			= require('knex');
var cookieParser 	= require('cookie-parser');
var bodyParser 		= require('body-parser');
var session 		= require('express-session');
var cors 			= require('cors')



//Setup Dabase Pool
var knex = Knex({
    client: 'pg',
    connection: {
        host: "ec2-50-16-238-141.compute-1.amazonaws.com",
        port: 5432,
        user: "sevthuwntxfnpz",
        password: "O2noM3Or0S8fkdi_FRNUS7hVHx",
        database: "de7d0ct6hrofib",
        ssl: true
    },
    debug : true
});

var bookshelf = require('bookshelf')(knex);

//Load local access objects
/*
var models = {
	contact : require("./models/contact")(knex),
	order : require("./models/dorrbell_order")(bookshelf)
}*/

var models = require("./models/models.js")(bookshelf);

//Main app
var app = express();
app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));


app.use(cors());

app.use(bodyParser.json());



var apiRoutes = express.Router();

apiRoutes.post('/authenticate', function(req, res){

  models.Contact.where('email', req.body.username).fetch().then(function(user){
    console.log(user);
    if(!user){
      res.status(401);
      res.json({
        success : false,
        message : 'Authentication failed. User not found'
      });
    }else if(user){
      if(user.get("password__c") != req.body.password){
        res.status(401);
        res.json({
          success : false,
          message : 'Authentication failed. Wrong Pasword.'
        });
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
  }, function(err){
    res.json({
      success : false,
      message : err
    });
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

require('./routes/authenticated')(apiRoutes, models);

app.use('/api', apiRoutes);


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});






