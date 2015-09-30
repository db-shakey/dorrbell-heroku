var express 		= require('express');
var passport 		= require('passport');
var LocalStrategy = require('passport-local').Strategy;
var fs 				= require('fs');
var Knex 			= require('knex');
var cookieParser 	= require('cookie-parser');
var bodyParser 		= require('body-parser');
var session 		= require('express-session');




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
    }
});

//Load local access objects
var contact = require("./server/contact")(knex);

//Configure Passport
passport.use(new LocalStrategy(
	function(username, password, done) {
		contact.findByUsername(username, function(user, err){
			console.log(user);
			if(err){return done(err);}
			else if(!user){return done(null, false);}
			else if(user.password__c != password){return done(null, false);}
			else return done(null, user);
		});
	}
));

passport.serializeUser(function(user, cb) {
  cb(null, user.sfid);
});

passport.deserializeUser(function(id, cb) {
	contact.findBySfid(id, function(user, err){
		if(err){
			return cb(err);
		}else{
			cb(null, user);
		}
	});
});


//Main app
var app = express();
app.set('port', (process.env.PORT || 5000));
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(express.static(__dirname + '/public'));

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

app.use(passport.initialize());
app.use(passport.session());



app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/contact', require('connect-ensure-login').ensureLoggedIn(), function(request, response){
	contact.getAllContacts(function(res){
		response.send(res);
	}, function(err){
		response.send(err);
	});
})
app.get('/login',
  function(req, res){
    res.send(401,{ success : false, message : 'authentication failed' });
  });

app.post('/login',
  passport.authenticate('local', { failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/contact');
 });

app.post('/noauth', function(req, res){
	contact.findByUsername(req.body.username, function(user, err){
		res.send(user);
	})
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


