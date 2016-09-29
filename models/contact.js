var db = require('../middlewares/salesforce');

exports.search = function(query){

}

exports.all = function(){
  return db.getConnection().query(`SELECT Id,
                                          FirstName,
                                          LastName,
                                          Phone,
                                          MailingStreet,
                                          MailingCity,
                                          MailingState,
                                          MailingPostalCode,
                                          MailingAddress
                                    FROM Contact
                                    ORDER BY LastName ASC LIMIT 10`);
}
