var AWS = require('aws-sdk');
var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var pg = require('pg');
var settings = require('../config.js');
var exec = require('child_process').exec;
var flow = require('flow');
// CronJob = require('cron').CronJob;

var PostGresHelper = require("./routes/postGresHelper.js");
var pghelper = new PostGresHelper();


var PostGresRefresh = function() {

}

PostGresRefresh.prototype.run = function(cb){
  var self = this;

  var refresh = flow.define(
    function() {

      this.cb = cb;

      self.fetchBackup(this);

    },
    function() {

      // this will prevent connections to the database and
      var sql = "UPDATE pg_database " +
      "SET datallowconn = 'false' " +
      "WHERE datname = '" + settings.pg.database + "'; " +
      // this will then kill all existing connections
      "SELECT pg_terminate_backend (pg_stat_activity.pid) " +
      "FROM pg_stat_activity " +
      "WHERE pg_stat_activity.datname = '" + settings.pg.database + "';";
      pghelper.query(sql, this)

    },
    function() {

      var sql = "DROP DATABASE IF EXISTS " + settings.pg.database + ";";
      pghelper.query(sql, this)

    },
    function() {

      // create a new db
      var command = 'sudo -u postgres createdb -O ubuntu '+ settings.pg.database;
      exec(command, function (error, stdout, stderr) {
          if (error !== null) {
            console.log('exec error: ' + error);
          } else {
            var sql = "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;"
            pghelper.query(sql, this);
          }
      });

    },
    function() {

      // restore the db from the backup
      var command = "psql " + settings.pg.database + " < " + self.filePath;
      exec(command, function (error, stdout, stderr) {
          if (error !== null) {
            console.log('exec error: ' + error);
          } else {
            var sql = "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;"
            pghelper.query(sql, this);
          }
      });

    },
    function() {
      console.log("refresh complete");
      this.cb();
    }
  );

  refresh();

}


PostGresRefresh.prototype.fetchBackup(cb){

  var self = this;

  var listParams = {
    Bucket: settings.s3.bucket
  };
  s3.listObjects(listParams, function(err, data) {
    if(err){
      console.log(err, err.stack); // an error occurred
    }
    else{
      // grab the metadata of he most recent backup file on S3
      var mostRecent = {}; // variable to hold the object describing the most recently modified file
      mostRecent.LastModified = "01/01/1900"; // date for initial comparison
      var valid_extensions = [".out"]; // ignore files that don't have the right extension
      data.Contents.forEach(function (object) {
        var ext = path.extname(object.Key);
        if(new Date(object.LastModified) > new Date(mostRecent.LastModified) && valid_extensions.indexOf(ext) > -1){
          mostRecent = object;
        }
      });
      // download the most recent (zipped) backup file and decompress it in the process
      // // compressing or decompressing a file can be done by piping an fs.ReadStream
      // // into a zlib stream, then into an fs.WriteStream
      var getParams = {
        Bucket: settings.s3.bucket,
        Key: mostRecent.Key
      };

      self.filePath =  path.join(__dirname, 'backups', getParams.Key); // save this value for use between functions in the flow

      // get the names of files in the backups folder
      fs.readdir(path.join(__dirname, 'backups'), function(err, files){
        if(err) { console.log(err); }
        // check that the file on S3 is different
        if(files.indexOf(getParams.Key) > -1) {
          console.log("most recent file already fetched");
          cb();
        } else {
          // delete the old file
          files.forEach(function(element, index){
            var elementExt = path.extname(element);
            // delete only files with the valid extensions
            if(valid_extensions.indexOf(elementExt) > -1){
              var elementPath = path.join(__dirname, 'backups', element);
              fs.unlink(elementPath, function (err) {
                if (err) throw err;
                console.log('successfully deleted :', element);
              });
            }
          });
          // fetch the new file
          var gzip = zlib.Gunzip();
          var out = fs.createWriteStream(self.filePath);
          s3.getObject(getParams).createReadStream().pipe(gzip).pipe(out);
          out.on('finish', function(){
            console.log("backup fetched");
            cb();
          });
        }
      });
    }
  });
}
