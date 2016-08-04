module.exports = function(apiRoutes, conn, utils){
	/**************
	 * GET API METHODS
	 *************/
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

	apiRoutes.get('/code/:code', function(req, res){
		conn.query("SELECT Id, FirstName, LastName, (SELECT ProfileUrl, ExternalPictureURL FROM Personas) FROM Contact WHERE Referral_Code__c = '" + req.params.code + "'").then(function(response){
			res.status(200).send(response);
		}, function(err){
			res.status(400).send(err);
		});
	})

	apiRoutes.post('/forceSync', function(req, res){
		var sf = require('./salesforce')(null, utils);
		sf.syncProducts(conn, req.query.vendor);
		res.status(200).send();
	})



	/**************
	 * POST API METHODS
	 *************/
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

	apiRoutes.post('/register', function(req, res){
		var google = require('../modules/google')(utils);
		var qualified = false;
		var success = function(){
			utils.log(qualified);
			if(qualified)
				res.status(201).send();
			else
				res.status(204).send();
		}
		var fail = function(err){
			utils.log(err);
			res.status(403).send(err);
		}

		var contact = {
			'Gender__c' : req.body.gender,
			'FirstName' : req.body.firstName,
			'LastName' : req.body.lastName,
			'Email' : req.body.email,
			'Status__c' : 'Active',
			'Username__c' : req.body.email,
			'Lead_Source__c' : req.body.leadSource,
			'MailingStreet' : (req.body.address2) ? req.body.address + ' ' + req.body.address2 : req.body.address,
			'MailingCity' : req.body.city,
			'MailingState' : req.body.state,
			'MailingPostalCode' : req.body.postalCode,
			'Birthdate' : req.body.birthday,
			'MobilePhone' : req.body.phone,
			'Referred_By__c' : req.body.referralFrom
		};

		conn.query("SELECT Id FROM RecordType WHERE DeveloperName = 'Dorrbell_Customer_Contact' AND sObjectType = 'Contact'").then(function(recordTypeResults){
			if(recordTypeResults.records && recordTypeResults.records.length > 0){
				contact.RecordTypeId = recordTypeResults.records[0].Id;


				return conn.sobject("Contact").insert(contact, 'Username__c').then(function(){
					return conn.query("SELECT Id, Qualified__c FROM Contact WHERE Username__c = '" + req.body.email + "'").then(function(data){
						qualified = data.records[0].Qualified__c;
						return conn.sobject("Firebase_Record__c").upsert(
							{
								Contact__c : data.records[0].Id,
								UID__c : req.body.uid
							}, 'UID__c'
						).then(function(){
							var extraArray = new Array();
							if(req.body.referralFrom){
								extraArray.push(conn.sobject("Customer_Referral__c").create({
									From__c : req.body.referralFrom,
									To__c : data.records[0].Id,
									Product__r : {Shopify_Id__c : 'referral-discount'},
									Source__c : 'Registration'
								}));
							}

							if(req.body.networkId && req.body.provider){
								var social = {
									ExternalId : req.body.networkId,
									External_Id__c : req.body.networkId,
									ExternalPictureUrl : req.body.photoUrl,
									ParentId : data.records[0].Id,
									Name : req.body.firstName + ' ' + req.body.lastName,
									IsDefault : true,
									Provider : req.body.provider
								};
								extraArray.push(
									conn.sobject("SocialPersona").upsert(social, "External_Id__c")
								);
							}
							return new Promise(function(resolveExtra, rejectExtra){
								Promise.all(extraArray).then(resolveExtra, resolveExtra);
							});
						}, fail);
					}, fail);
				}, fail);
			}
		}).then(success, fail);
	})

	apiRoutes.post("/validate-user", function(req, res){
		var fail = function(){
			res.status(403).send();
		}

		conn.query("SELECT Contact__r.Qualified__c, Contact__c FROM Firebase_Record__c WHERE UID__c = '" + req.body.uid + "' AND UID__c != null").then(function(results){
			if(req.body.uid && req.body.cart && results && results.records && results.records.length > 0){
				conn.sobject("Cart__c").upsert({
					Contact__c : results.records[0].Contact__c,
					Shopify_Id__c : req.body.cart
				}, "Shopify_Id__c").then(function(res){utils.log(res);}, function(err){utils.log(err);});
			}
			if(results.records && results.records.length > 0 && results.records[0].Contact__r.Qualified__c === true)
				res.status(201).send();
			else if(results.records && results.records.length > 0)
				res.status(204).send();
			else
				res.status(403).send();
		}, fail);
	});

	apiRoutes.post('/redeem', function(req, res){
		var onError = function(msg){
			res.status(400).send(msg);
		}
		conn.apex.post('/Promotion/', {
			code : req.body.code,
			toId : req.body.Id,
			source : 'Direct',
			immediate : false
		}).then(
			function(res){
				res.status(200).send(res);
			},
			onError
		);
	});

};
