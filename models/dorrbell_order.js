module.exports = function(bookshelf){
  
	var Order = bookshelf.Model.extend({
		tableName : 'dorrbell_order__c',
		deliveries : function(){
			return this.hasMany(Delivery);
		}
	});

	var Delivery = bookshelf.Model.extend({
		tableName : 'delivery__c',
		order : function(){
			return this.belongsTo(Order);
		},
		deliveryItems : function(){
			return this.hasMany(DeliveryItem);
		}
	});

	var DeliveryItems = bookshelf.Model.extend({
		tableName : 'delivery_item__c',
		delivery : function(){
			return this.belongsTo(Delivery);
		}
	})


 	return {
 		getOrdersByType : function(type, callback, error){
 			knex.select('dorrbell_order__c.sfid', 
 						'dorrbell_order__c.name', 
 						'dorrbell_order__c.delivery_date__c', 
 						'dorrbell_order__c.drop_off_time__c')
 					.from('dorrbell_order__c')
 					.innerJoin('recordtype', 'dorrbell_order__c.recordtypeid', 'recordtype.sfid')
 					.where('recordtype.developername', type)
 					.andWhere('delivery_date__c', '<>', 'null')
 					.andWhere('drop_off_time__c', '<>', 'null')
 			.then(function(records){
 				callback(records);
 			}, error);
 		},
 		getOrderById : function(sfid, callback, error){
 			knex.select('dorrbell_order__c.sfid',
 						'dorrbell_order__c.drop_off_time__c',
 						'dorrbell_order__c.next_step__c',
 						'dorrbell_order__c.status__c',
 						'dorrbell_order__c.delivery_street__c',
 						'dorrbell_order__c.shopify_customer_name__c',
 						)


 			knex.from('dorrbell_order__c').where('sfid', sfid).then(function(records){
 				callback(records[0]);
 			}, error);
 		}
 	}
  
}