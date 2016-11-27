var express = require('express');
var app = express();
var cors = require('cors');
var bodyParser 		= require('body-parser');
var jsforceAjaxProxy = require('jsforce-ajax-proxy');

if(!process.env.PORT){
  require('node-env-file')(__dirname + '/.env');
}
app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({limit : '50mb'}));
app.use(cors());
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.all('/proxy/?*', jsforceAjaxProxy({ enableCORS: false }));
app.use(require('./middlewares/salesforce').authenticate)
app.use(require('./controllers'));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
