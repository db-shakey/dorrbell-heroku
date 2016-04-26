module.exports = function(utils, conn){
  var shopify = require('../modules/shopify')(utils);

  var errorHandler = function(err, res){
    utils.log(err);
    res.status(400).send();
  }

  return {
    upsertOrder : function(product){
        utils.log(body);
        return conn.apex.post('/Order/', body);
    },

    deleteOrder : function(productId){

    }
  }

};
