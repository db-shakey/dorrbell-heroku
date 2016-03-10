module.exports = function(utils){
    var key = 'AIzaSyDwQGc8Z6vioP4_7wNBB8ymrhHfj8aMKdo';
    var http = require('https');

    return {
        getTimezoneOffset : function(latitude, longitude, timestamp){
            utils.log('/maps/api/timezone/json?key=' + key + '&location=' + latitude + ',' + longitude + '&timestamp=' + (new Date().getTime() / 1000));
            return new Promise(function(resolve, reject){
              var req = http.get({
                host : 'maps.googleapis.com',
                path : '/maps/api/timezone/json?key=' + key + '&location=' + latitude + ',' + longitude + '&timestamp=' + (new Date().getTime() / 1000)
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
                reject(e);
                utils.log(e);
              });
            });
        }
    }

};
