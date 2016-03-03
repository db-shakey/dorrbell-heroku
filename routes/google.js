module.exports = function(utils){
    var key = 'AIzaSyDwQGc8Z6vioP4_7wNBB8ymrhHfj8aMKdo';

    return {
        getTimezoneOffset : function(latitude, longitude, timestamp){
            return new Promise(function(resolve, reject){
              var req = http.get({
                host : 'maps.googleapis.com/',
                path : '/maps/api/timezone/json?key=' + key + '&location=' + latitude + ',' + longitude + '&timestamp=' + new Date().getTime()
              }, function(response){
                var body = '';
                response.on('data', function(d){
                  body += d;
                });
                response.on('end', function(){
                  resolve(JSON.parse(body));
                });
                response.on('error', reject);
              });
              req.on('error', function(e) {
                utils.log(e);
              });
            });
        }
    }

});