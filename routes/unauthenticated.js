module.exports = function(apiRoutes, conn, utils){

	apiRoutes.post('/lead', function(req, res){
		var lead = req.body;
		utils.log(lead);
		conn.query("SELECT Id FROM RecordType WHERE SObjectType = 'Contact' AND DeveloperName = 'Dorrbell_Customer_Contact'", function(err, data){
			if(err || !data.records){
				res.status(400).json({
					success : false,
	        message : 'Insert failed. Record Type Not Found'
				});
			}else{
				var recType = data.records[0];
				utils.log('got record type');
				if(!lead.email || !lead.zip){
					res.status(400).json({
	          success : false,
	          message : 'Email and Zip Code are required'
	        });
				}else{
					utils.log('creating contact');
					conn.sobject("Contact").create({
						LastName : 'NA',
						LeadSource : 'Web',
						Email : lead.email,
						MailingPostalCode : lead.zip,
						RecordTypeId : recType.Id,
						Status__c : 'disabled'
					}, function(err, ret){
						if(err || !ret.success)
							res.status(400).json({
								success : false,
								message : err
							});
						else
							res.status(200).send("Ok");
					})
				}
			}
		})
	});

	apiRoutes.get('/contact/:contactId', function(req, res){
		conn.query("SELECT Id, Email FROM Contact WHERE Id = '" + req.params.contactId + "'", function(err, data){
			if(err || !data.records){
				res.status(400).json({
					success : false,
					message : 'Insert failed. Record Type Not Found'
				});
			}else{
				res.status(200).json(data.records[0]);
			}
		})
	});

	apiRoutes.post('/authenticate', function(req, res){
	  conn.query("SELECT Id, \
	  					Password__c, \
	  					Email, \
	  					Name, \
	  					FirstName, \
	  					LastName, \
	  					MobilePhone, \
	  					RecordType.Name, \
	  					RecordType.DeveloperName, \
							Mailing_Location__Latitude__s, \
							Mailing_Location__Longitude__s, \
	  					Store__c \
	  				FROM Contact WHERE Email = '" + req.body.username + "'", function(err, data){
	    var user = data.records[0];

	    if(err || !user){
	      res.status(401).json({
	        success : false,
	        message : 'Authentication failed. User not found'
	      })
	    }else if(user){
	      if(
					//GET RID OF THIS FIRST LINE
					user.password__c != req.body.password ||
					user.password__c != utils.encryptText(req.body.password)){
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

	apiRoutes.post('/registershopify/:contactId', function(req, res){
		var shopify = require('./shopify')(utils);
		var contact = req.body;

		if(!utils.validateContact(contact))
			res.status(400).json({
				success : false,
				message : 'Error Registering'
			});
		else{
			shopify.createCustomer(contact).then(function(data){
				var shopData = JSON.parse(data);
				contact.Password__c = utils.encryptText(contact.Password__c);
				contact.Status__c = 'Active';
				contact.Shopify_Customer_ID__c = shopData.customer.id;
				conn.sobject('Contact').update(
					contact
					,function(err, rets){
						if(err){
							res.status(400).send(err);
						}else{
							res.json({
								success : true,
								message : 'Ok'
							});
						}
					}
				);
			}, function(err){
				res.status(400).json({
					success : false,
					message : err
				})
			});
		}
	})

	apiRoutes.post('/register/:contactId', function(req, res){
		var contact = req.body;
		utils.log(contact);
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
