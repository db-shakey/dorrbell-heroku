module.exports = function(crypto, jwt){

	var password = 'd00rb3ll_secret';
	var algorithm = 'aes-256-ctr';
	var token = 'Basic am9zaHVhQGRvcnJiZWxsLmNvbTpkMDByYjMxMV9hcHBsaWNhdGlvbg==';

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
			return req.headers['authorization'] == token;
		},
		encryptText : function(text){
			var cipher = crypto.createCipher(algorithm,password)
		    var crypted = cipher.update(text,'utf8','hex')
     		crypted += cipher.final('hex');
	  		return crypted;
		},
		decryptText : function(text){
			var decipher = crypto.createDecipher(algorithm,password)
			var dec = decipher.update(text,'hex','utf8')
			dec += decipher.final('utf8');
			return dec;
		},
		signUser : function(user){
			return jwt.sign(user, password, {
      			expiresInMinutes : 1440 //24 hours
    		});
		},
		getPassword : function(){
			return password;
		}
	}

}