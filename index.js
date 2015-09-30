var express = require('express');
var sass = require('node-sass');
var fs = require('fs');
var bodyParser = require('body-parser');
var Knex = require('knex');

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

var contact = require("./server/contact")(knex);

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});

app.get('/contact', function(request, response){
	contact.getAllContacts(function(res){
		response.send(res);
	}, function(err){
		response.send(err);
	});
})

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});


