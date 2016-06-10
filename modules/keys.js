module.exports = function(){

  return {
    shopifyApiKey : '931caa3db7945b8ed0baaa1694d1a302',
    shopifyPassword : '2aa794cd88df4c10f5e9146c1056e88e',
    shopifyEndpoint : 'dorrbell-test.myshopify.com',
    password : 'd00rb3ll_secret',
    token : 'Basic Z14vbjcyayxOdUpnM0pfXw==',
    sfToken : 'BASIC flAuOXUvdyJQZ0ZxJUNMag==',
    shopify_key : '5c93443153ae4d621d78b67355df7e41',
    sfUsername : 'shakey@dorrbell.com',
    sfPassword : 'Seketha3OcPjDdJZZOaB9LEGuQs2lnwwm',
    shopifyUrl : function(){
      return 'https://' + this.shopifyApiKey + ':' + this.shopifyPassword + '@' + this.shopifyEndpoint;
    }
  }

};
