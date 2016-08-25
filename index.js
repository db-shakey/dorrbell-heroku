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
var path          = require('path');
var raven         = require('raven');
//Main app
var app = express();

if(!process.env.PORT){
  require('node-env-file')(__dirname + '/.env');
}

app.set('port', (process.env.PORT || 5050));
app.use(express.static('public'));

app.use(raven.middleware.express.requestHandler('https://d9174acab3fe487eb8a8e1045ee5b66c:dcf700841bea4f58a9d85d5c2519a3b3@app.getsentry.com/87887'));
app.use(cors());
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json({
    verify : function(req, res, buf, encoding){
        req.headers['x-generated-signature'] = crypto.createHmac('sha256', process.env.shopify_key)
        .update(buf)
        .digest('base64');
    },
    limit : '50mb'
}));

var apiRoutes = express.Router();
var webhooks = express.Router();
var sfRoutes = express.Router();
var retailRoutes = express.Router();

var conn = new jsforce.Connection({
    maxRequest : 50,
    loginUrl : process.env.sfLoginUrl
});
var socketServer;

conn.login(process.env.sfUsername, process.env.sfPassword, function(err, res){
    if(err){return console.error(err);}
});

var firebase = require('firebase');
firebase.initializeApp({
  serviceAccount: process.env.firebaseCredentials,
  databaseURL: process.env.firebaseUrl
});


var user = require('./modules/user')(crypto, jwt);

/**
*  Endpoints for posting errors and logging
*/
apiRoutes.get('/log', function(req, res){
    res.sendFile(path.join(__dirname + '/pages/log.html'));
});

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




require('./routes/webhooks')(webhooks, conn, user);
var sf = require('./routes/salesforce')(sfRoutes, user);
var fb = require('./routes/firebase')(sfRoutes, user, conn, firebase);
sf.startProductPoll(conn);

require('./routes/public')(apiRoutes, conn, user);
require('./routes/retail')(retailRoutes, conn, user, firebase);

var socketUtils = require('./modules/utils')();
require('./routes/mobile')(apiRoutes, conn, socketUtils, user);


/**
* Finalize server and setup sockets
*/
app.use('/api', apiRoutes);
app.use('/webhook', webhooks);
app.use('/sf', sfRoutes);
app.use('/retail', retailRoutes);

// The error handler must be before any other error middleware
app.use(raven.middleware.express.errorHandler('https://d9174acab3fe487eb8a8e1045ee5b66c:dcf700841bea4f58a9d85d5c2519a3b3@app.getsentry.com/87887'));


var server = http.createServer(app);
var io = require('socket.io')(server,{
    path: '/socket.io-client'
});
io.set('transports', ['websocket']);

io.sockets.on("connection", function(socket){
    socketUtils.addConnection(socket);

    socket.on("update", function(data){
        io.to(data.id).emit("update", data);
        //socket.broadcast.emit("update", data);
    })
});

user.setSocketServer(io);

server.listen(app.get('port'), function(){
    console.log("Dorrbell standard listening on port " + app.get('port'));
});


https.createServer({
    key : fs.readFileSync('./certs/mykey.pem'),
    cert : fs.readFileSync('./certs/mycert.pem'),
    ca : fs.readFileSync('./certs/ca.key'),
    requestCert : false,
    rejectUnauthorized : false
}, app).listen(8000, function(){
    console.log("Dorrbell secure listening on port 8000");
});
