module.exports = function(knex){
  

 	return {
 		getAllContacts : function(callback){
 			knex.select().table('contact').then(callback);
 		},
 		findByUsername : function(username, callback){
 			return knex.select().table('contact').where('email', username).then(function(records){
 				callback(records[0]);
 			});
 		},
 		findBySfid : function(sfid, callback){
 			return knex.select().table('contact').where('sfid', sfid).then(function(records){
 				callback(records[0]);
 			});
 		}
 	}
  
}