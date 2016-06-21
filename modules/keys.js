module.exports = function(){

  return {
    shopifyApiKey : '931caa3db7945b8ed0baaa1694d1a302',
    shopifyPassword : '2aa794cd88df4c10f5e9146c1056e88e',
    shopifyEndpoint : 'dorrbell-test.myshopify.com',
    password : 'd00rb3ll_secret',
    token : 'Basic Z14vbjcyayxOdUpnM0pfXw==',
    sfToken : 'BASIC flAuOXUvdyJQZ0ZxJUNMag==',
    shopify_key : '795027ada3cf89abf34972a81301ef1c00db9671546fc890649ac07e4bedc62b',
    sfUsername : 'christopher.moyle@dorrbell.com.staging',
    sfPassword : 'dzq84K2JfjCtdBtQmQp1weuIW99q0rrd',
    shopifyUrl : function(){
      return 'https://' + this.shopifyApiKey + ':' + this.shopifyPassword + '@' + this.shopifyEndpoint;
    }
  }

};
