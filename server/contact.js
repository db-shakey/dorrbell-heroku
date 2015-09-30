module.exports = function(knex){
  

 	return {
 		getAllContacts : function(callback){
 			knex.select().table('contact').then(callback);
 		}
 	}
  
}