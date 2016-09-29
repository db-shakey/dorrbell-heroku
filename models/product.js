var db = require('../middlewares/salesforce');

exports.all = function(){
  var fs = require('fs');
  return db.getConnection().query(`SELECT Id,
                                          Apttus_Config2__ProductId__c,
                                          Apttus_Config2__ProductId__r.Name,
                                          Apttus_Config2__ProductId__r.Description,
                                          Apttus_Config2__ProductId__r.Id,
                                          Apttus_Config2__ProductId__r.Family,
                                          Apttus_Config2__ListPrice__c
                                    FROM Apttus_Config2__PriceListItem__c
                                    WHERE Apttus_Config2__PriceListId__r.Name = 'Barefoot Price List'`)
  .then(function(data){
    var productIds = new Array();
    data.records.forEach(record => {
      productIds.push("'" + record.Apttus_Config2__ProductId__c + "'");
    })
    return db.getConnection().query(`SELECT Id, Product2Id FROM PricebookEntry WHERE Product2Id IN (` + productIds.join(', ') + `)`).then(function(pbData){
      pbData.records.forEach(record => {
        data.records.forEach(product => {
          if(product.Apttus_Config2__ProductId__c == record.Product2Id)
            product.Apttus_Config2__ProductId__r.PricebookEntryId = record.Id;
        });
      });
      return new Promise(function(r, e){r(data);});
    });

    db.getConnection().query(`SELECT Id, ParentId FROM Attachment WHERE ParentId IN (` + productIds.join(', ') + `)`).then(function(attData){
      attData.records.forEach(record => {
        var fileOut = fs.createWriteStream('public/images/' + record.ParentId + '.png', {flags : 'w', autoClose : true});
        fileOut.on("error", function(err){console.log(err);})
        var file = db.getConnection().sobject('Attachment').record(record.Id).blob('Body').pipe(fileOut);
      });
    });
  });
}
