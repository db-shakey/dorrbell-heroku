module.exports = function(route, conn, utils){

  route.get('/contact-public', function(request, response){
    conn.query("SELECT Id FROM Contact LIMIT 5").then(function(records){
      response.status(200).send(records);
    }, function(err){
      console.log(err);
    })
  });

};
