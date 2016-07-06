module.exports = function(crypto, jwt){

	var algorithm = 'aes-256-ctr';
	var keys = require('../modules/keys')();

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
		checkToken : function(req){
			return req.headers['authorization'] == keys.token;
		},
		checkSfToken : function(req){
			return req.headers['authorization'] == keys.sfToken;
		},
		encryptText : function(text){
			var cipher = crypto.createCipher(algorithm,keys.password)
		    var crypted = cipher.update(text,'utf8','hex')
     		crypted += cipher.final('hex');
	  		return crypted;
		},
		decryptText : function(text){
			var decipher = crypto.createDecipher(algorithm,keys.password)
			var dec = decipher.update(text,'hex','utf8')
			dec += decipher.final('utf8');
			return dec;
		},
		signUser : function(user){
			return jwt.sign(user, keys.password, {
      			expiresIn : "365d" //24 hours
    		});
		},
		getPassword : function(){
			return keys.password;
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
