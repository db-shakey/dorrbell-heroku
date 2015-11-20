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
				for(var i in connectionArray){
					if(connectionArray[i].id == socketId){
						socket = connectionArray[i];
						break;
					}
				}
			}

			for (var p in obj) {
		        if (obj.hasOwnProperty(p)) {
		            if (p === "Id") {
		            	console.log("Socket " + socketId + " joining room " + obj[p]);
		            	socket.join(obj[p]);
		            } else if (obj[p] instanceof Object) {

		                this.joinRooms(obj[p], socketId, socket);
		            }
		        }
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
		}
	}

}