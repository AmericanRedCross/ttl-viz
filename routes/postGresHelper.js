var pg = require("pg"),
settings = require("../config.js");

var PostGresHelper = function() {

  // PostGIS Connection String
  this.conString = "postgres://" +
  settings.pg.user + ":" +
  settings.pg.password + "@" +
  settings.pg.server + ":" +
  settings.pg.port + "/" +
  settings.pg.database;

  this.postgresConString = "postgres://" +
  settings.pg.user + ":" +
  settings.pg.password + "@" +
  settings.pg.server + ":" +
  settings.pg.port + "/" +
  "postgres";

};


PostGresHelper.prototype.query = function(queryStr, cb) {
  pg.connect(this.conString, function(err, client, done) {
    if (err) {
      console.error('error fetching client from pool', err);
    }

    client.query(queryStr, function (queryerr, result) {
      //call `done()` to release the client back to the pool
      done();

      if (queryerr) {
        console.error('ERROR RUNNING QUERY:', queryStr, queryerr);
      }

      console.log("Ran Query: " + queryStr);

      cb((err || queryerr), (result && result.rows ? result.rows : result));

    });
  });
};

PostGresHelper.prototype.adminQuery = function(queryStr, cb) {
  pg.connect(this.postgresConString, function(err, client, done) {
    if (err) {
      console.error('error fetching client from pool', err);
    }

    client.query(queryStr, function (queryerr, result) {
      //call `done()` to release the client back to the pool
      done();

      if (queryerr) {
        console.error('ERROR RUNNING QUERY:', queryStr, queryerr);
      }

      console.log("Ran Query: " + queryStr);

      cb((err || queryerr), (result && result.rows ? result.rows : result));

    });
  });
};


module.exports = PostGresHelper;
