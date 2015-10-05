module.exports = function(apiRoutes, conn, utils){

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

	apiRoutes.post('/authenticate', function(req, res){
	  conn.query("SELECT Id, Password__c, Email, Name FROM Contact WHERE Email = '" + req.body.username + "'", function(err, data){
	    var user = data.records[0];

	    if(err || !user){
	      res.status(401).json({
	        success : false,
	        message : 'Authentication failed. User not found'
	      })
	    }else if(user){
	      if(user.password__c != utils.encryptText(req.body.password)){
	        res.status(401).json({
	          success : false,
	          message : 'Authentication failed. Wrong Pasword.'
	        })
	      }else{
	        res.json({
	          success : true,
	          message : 'Enjoy your token',
	          token : utils.signUser(user)
	        });
	      }
	    }
	  });
	});

	apiRoutes.get('/beta/:betaKey', function(req, res){
		conn.query("SELECT Id, FirstName, LastName, Email, MobilePhone, Status__c FROM Contact WHERE Beta_Key__c = '" + req.params.betaKey + "'", function(err, data){
			var contact = data.records[0];
			if(err || !contact){
				res.status(400).json({
					success : false, message : 'The beta key you entered is incorrect.'
				});
			}else if(contact.Status__c == 'Active'){
				res.status(400).json({
					success : false, message : 'This beta key is already in use.'
				});
			}else if(contact){
				res.send(contact);
			}
		});
	});

	apiRoutes.post('/register/:contactId', function(req, res){
		var contact = req.body;
		if(!utils.validateContact(contact))
			res.status(400).json({
				success : false,
				message : 'Error Registering'
			});
		else{
			contact.Password__c = utils.encryptText(contact.Password__c);
			contact.Status__c = 'Active';

			conn.sobject('Contact').update([
				req.body
			], function(err, rets){
				if(err){res.status(400).send(err);}
				else if(!rets[0].success){res.status(400).send(rets[1]);}
				else{
					res.json({
						success : true,
						message : 'Ok'
					});
				}
			});
		}

	});

};