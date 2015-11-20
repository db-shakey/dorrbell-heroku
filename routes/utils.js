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
		}
	}

}