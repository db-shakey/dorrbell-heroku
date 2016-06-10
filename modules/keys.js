module.exports = function(){

  return {
    shopifyApiKey : '12ad97558a61e66e2b4bde6dd8f97cd9',
    shopifyPassword : 'e465022f2fbf924b05f710f403758345',
    shopifyEndpoint : 'homefit.myshopify.com',
    password : 'd00rb3ll_secret',
    token : 'Basic Z14vbjcyayxOdUpnM0pfXw==',
    sfToken : 'BASIC flAuOXUvdyJQZ0ZxJUNMag==',
    shopify_key : '5c93443153ae4d621d78b67355df7e41',
    sfUsername : 'christopher.moyle@dorrbell.com',
    sfPassword : 'dzq84K2JQLaQbcnzwvxw9qylGljuRG4bq',
    shopifyUrl : function(){
      return 'https://' + this.shopifyApiKey + ':' + this.shopifyPassword + '@' + this.shopifyEndpoint;
    }
  }

};
