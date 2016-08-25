module.exports = function(crypto, jwt){

	var algorithm = 'aes-256-ctr';
	var io;

	return {
		validateContact : function(contact){
			try{
				if(!contact
					|| contact.Email.trim().length < 6
					|| contact.FirstName.trim().length < 3
					|| contact.LastName.trim().length < 3
					|| contact.MobilePhone.trim().length < 9
					|| contact.Password__c.trim().length < 6){
					return false;
				}else
					return true;
			}catch(err){
				return false;
			}
			return false;
		},
		verifyJwt : function(req, res, next){
			// check header or url parameters or post parameters for token
	    var token = req.body.token || req.query.token || req.headers['x-access-token'];
	    // decode token
	    if (token) {
	        // verifies secret and checks exp
	        jwt.verify(token, process.env.password, {ignoreExpiration : true}, function(err, decoded) {
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
		},
		checkToken : function(req){
			return req.headers['authorization'] == process.env.token;
		},
		checkSfToken : function(req){
			return req.headers['authorization'] == process.env.sfToken;
		},
		encryptText : function(text){
			var cipher = crypto.createCipher(algorithm,process.env.password)
		    var crypted = cipher.update(text,'utf8','hex')
     		crypted += cipher.final('hex');
	  		return crypted;
		},
		decryptText : function(text){
			var decipher = crypto.createDecipher(algorithm,process.env.password)
			var dec = decipher.update(text,'hex','utf8')
			dec += decipher.final('utf8');
			return dec;
		},
		signUser : function(user){
			return jwt.sign(user, process.env.password, {
      			expiresIn : "365d" //24 hours
    		});
		},
		getPassword : function(){
			return process.env.password;
		},
		setSocketServer : function(socketServer){
			io = socketServer;
		},

		verifyWebhook : function(req){
			return req.headers['x-generated-signature'] == req.headers['x-shopify-hmac-sha256'];
		},

		log : function(msg, line){
			console.log(msg);
			if(io){
				if(line)
					io.sockets.emit("log", '--------------' + line + '-------------');
				io.sockets.emit("log", msg);
			}
		}
	}

}
