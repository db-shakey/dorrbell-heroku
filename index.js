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
//Main app
var app = express();

app.set('port', (process.env.PORT || 5000));
app.use(express.static('public'));


app.use(cors());
app.use(bodyParser.json({
    verify : function(req, res, buf, encoding){
        req.headers['x-generated-signature'] = crypto.createHmac('sha256', '5c93443153ae4d621d78b67355df7e41')
        .update(buf)
        .digest('base64');
    }
}));

var apiRoutes = express.Router();
var webhooks = express.Router();
var sfRoutes = express.Router();


var conn = new jsforce.Connection({
    maxRequest : 50
});
var socketServer;

conn.login('shakey@dorrbell.com', 'Seketha3OcPjDdJZZOaB9LEGuQs2lnwwm', function(err, res){
    if(err){return console.error(err);}
});



var utils = require('./utils/app-utils')(crypto, jwt);

/**
*  Demo route for interview
*/
apiRoutes.get('/products-sample', function(req, res){
    conn.query("SELECT Id, \
    Name, \
    SKU__c, \
    Store__r.Name, \
    RecordType.Name, \
    Department__c, \
    Brand__c, \
    Image__r.Image_Source__c, \
    Family, \
    Description, \
    (SELECT Id, Name, SKU__c, Store__r.Name, RecordType.Name, Department__c, Brand__c, Image__r.Image_Source__c, Family, Description FROM Variants__r) \
    FROM Product2 \
    WHERE RecordType.DeveloperName = 'Product' \
    ORDER BY CreatedDate DESC LIMIT 30", function(err, recs){
        if(!err)
        res.status(200).send(recs);
        else
        res.status(401).send(err);
    })
})

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

/**
* All webhook requests go through webhooks
*/
//authenticate requests
webhooks.use(function(req, res, next){
    if(utils.verifyWebhook(req))
    next();
    else
    res.status(401).send("Invalid Signature");
});


require('./routes/webhooks')(webhooks, conn, utils);


/**
* All salesforce requests go through sf
*/
//authenticate requests
sfRoutes.use(function(req, res, next){
    utils.log(req.body);
    if(utils.checkSfToken(req))
    next();
    else{
        return res.status(403).send({
            success : false,
            message : 'Unauthorized Application'
        });
    }
});
require('./routes/braintree')(sfRoutes, utils);

/**
* All API requests go through apiRoutes
*/
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

var socketUtils = require('./routes/utils')();
var authPath = require('./routes/authenticated')(apiRoutes, conn, socketUtils, utils);




/**
* Finalize server and setup sockets
*/
app.use('/api', apiRoutes);
app.use('/webhook', webhooks);
app.use('/sf', sfRoutes);

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

utils.setSocketServer(io);

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
