module.exports = function(bookshelf){
  
	var model = {};

	model.Order = bookshelf.Model.extend({
		tableName : 'dorrbell_order__c',
		idAttribute : 'sfid',
		deliveries : function(){
			return this.hasMany(model.Delivery, "dorrbell_order__c");
		},
		contact : function(){
			return this.belongsTo(model.Contact);
		},
		recordtype : function(){
			return this.belongsTo(model.RecordType);
		}
	});

	model.RecordType = bookshelf.Model.extend({
		tableName : 'recordtype',
		idAttribute : 'sfid',
		orders : function(){
			return this.hasMany(model.Order, "recordtypeid");
		}
	})

	model.Delivery = bookshelf.Model.extend({
		tableName : 'delivery__c',
		order : function(){
			return this.belongsTo(model.Order);
		},
		deliveryItems : function(){
			return this.hasMany(model.DeliveryItem, "related_delivery__c");
		}
	});

	model.DeliveryItems = bookshelf.Model.extend({
		tableName : 'delivery_item__c',
		delivery : function(){
			return this.belongsTo(model.Delivery);
		}
	});

	model.Contact = bookshelf.Model.extend({
		tableName : 'contact',
		orders : function(){
			return this.hasMany(model.Order, "shopping_assistant_contact__c");
		}
	})

	return model;

}