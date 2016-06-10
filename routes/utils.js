module.exports = function(){

	var connectionArray = new Array();

	return {
		addConnection : function(conn){
			var index = connectionArray.push(conn) - 1;
			console.log('adding connection ' + conn.id);

			conn.on('close', function(closed){
				console.log((new Date()) + " Peer "
                + closed + " disconnected.");
				connectionArray.splice(index, 1);
			});
		},

		joinRooms : function(obj, socketId, socket){
			if(!socket){
				for(var i=0; i< connectionArray.length; i++){
					if(connectionArray[i].id.indexOf(socketId) != -1){
						socket = connectionArray[i];
						break;
					}
				}
			}

			for (var p in obj) {
		        if (obj.hasOwnProperty(p)) {
		            if (p === "Id" || this.isSalesforceId(obj[p])) {
		            	socket.join(obj[p]);
		            } else if (obj[p] instanceof Object) {
		                this.joinRooms(obj[p], socketId, socket);
		            }
		        }
		    }
		},
		isSalesforceId : function(strSf){
			if(!strSf || !strSf.length || strSf.length != 18)
				return false;
			else{
				var checksumMap = {
					'A' : '00000',
					'B' : '00001',
					'C' : '00010',
					'D' : '00011',
					'E' : '00100',
					'F' : '00101',
					'G' : '00110',
					'H' : '00111',
					'I' : '01000',
					'J' : '01001',
					'K' : '01010',
					'L' : '01011',
					'M' : '01100',
					'N' : '01101',
					'O' : '01110',
					'P' : '01111',
					'Q' : '10000',
					'R' : '10001',
					'S' : '10010',
					'T' : '10011',
					'U' : '10100',
					'V' : '10101',
					'W' : '10110',
					'X' : '10111',
					'Y' : '11000',
					'Z' : '11001',
					'0' : '11010',
					'1' : '11011',
					'2' : '11100',
					'3' : '11101',
					'4' : '11110',
					'5' : '11111'
				};
				var checksum = strSf.substring(15, 18);			//EAI
				var p1 = checksumMap[checksum.charAt(0)];		//00100
				var p2 = checksumMap[checksum.charAt(1)];		//00000
				var p3 = checksumMap[checksum.charAt(2)];		//01000
				if(p1 && p2 && p3){
					var p1r = p1.split("").reverse().join("");		//00100
					var p2r = p2.split("").reverse().join("");		//00000
					var p3r = p3.split("").reverse().join("");		//00010


					var valid = true;
					for(var i = 0; i < p1r.length; i++){
						var character = strSf.charAt(1 * i);
						valid = (p1r.charAt(i) == "1" && character == character.toUpperCase()) || (p1r.charAt(i) == "0" && character == character.toLowerCase())
						if(valid == false)
							break;
					}
					if(valid == true){
						for(var i = 0; i < p2r.length; i++){
							var character = strSf.charAt(2 * i);
							valid = (p2r.charAt(i) == "1" && character == character.toUpperCase()) || (p2r.charAt(i) == "0" && character == character.toLowerCase());
							if(valid == false)
								break;
						}
					}
					if(valid == true){
						for(var i = 0; i < p3r.length; i++){
							var character = strSf.charAt(3 * i);
							valid = (p3r.charAt(i) == "1" && character == character.toUpperCase()) || (p3r.charAt(i) == "0" && character == character.toLowerCase());
							if(valid == false)
								break;
						}
					}
					return valid;
				}else
					return false;
			}
		},
		getUser : function(conn, contactId, callback, error){
	  		var contact = new Promise(function(resolve, reject){
	  			conn.query("SELECT Id, \
			  					Password__c, \
			  					Email, \
			  					Name, \
			  					FirstName, \
			  					LastName, \
			  					MobilePhone, \
			  					RecordType.Name, \
			  					RecordType.DeveloperName, \
			  					Store__c, \
									Mailing_Location__Latitude__s, \
									Mailing_Location__Longitude__s, \
			  					(SELECT Id FROM Attachments WHERE Name = 'profile.jpg') \
			  				FROM Contact WHERE Id = '" + contactId + "'", function(err, data){
		  			if(err || !data.records)
		  				reject(err);
		  			else
		  				resolve(data.records[0]);
			  	});
	  		}).then(function(contact){
	  			if(contact.Attachments && contact.Attachments.records.length > 0){

	  				var string = '';

					var base64 = require('base64-stream');
	  				var readable = conn.sobject("Attachment").record(contact.Attachments.records[0].Id).blob("Body").pipe(base64.encode());
	  				readable.setEncoding('utf8');
	  				readable.on("data", function(chunk){
 						string += chunk;
	  				});
	  				readable.on('end',function(){
					 contact.thumbnail = "data:image/jpeg;base64," + string;
					 callback(contact);
					});
	  			}else{
	  				callback(contact);
	  			}
	  		}, function(err){
	  			error(err);
	  		})
		},

		setProfilePhoto : function(conn, contactId, imageData){
			return conn.query("SELECT Id FROM Attachment WHERE ParentId = '" + contactId + "' AND Name = 'profile.jpg'").then(function(data){
				if(data.records && data.records.length){
					var idArray = new Array();
					for(var i = 0; i<data.records.length; i++){
						idArray.push(data.records[i].Id);
					}
					return conn.sobject("Attachment").del(idArray);
				}else
					return new Promise(function(r, e){r();});
			}).then(function(){
				if(contactId && imageData && imageData.indexOf("base64,") != -1){
					var base64data = imageData.substring(imageData.indexOf("base64,") + 7);
					return conn.sobject("Attachment").create({
						ParentId : contactId,
						Name: "profile.jpg",
						body: base64data,
						ContentType: "image/jpeg"
					});
				}else{
					return new Promise(function(r, e){r();});
				}
			});
		}

	}

}
