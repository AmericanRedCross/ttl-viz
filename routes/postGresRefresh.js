var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var pg = require('pg');
var settings = require('../settings.js');
var exec = require('child_process').exec;
var flow = require('flow');
// CronJob = require('cron').CronJob;

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var PostGresHelper = require("../routes/postGresHelper.js");
var pghelper = new PostGresHelper();


var PostGresRefresh = function() {

}

PostGresRefresh.prototype.run = function(cb){
  var self = this;

  self.filePath = '';

  var refresh = flow.define(
    function() {

      self.fetchBackup(this);

    },
    function() {

      // this helps avoid at least one error when killing connections in the nest step
      // calling `pg.end()` disconnects all idle clients within all active pools, and has all client pools terminate.
      // ? Any currently open, checked out clients will still need to be returned to the pool before they will be shut down and disconnected.
      // https://github.com/brianc/node-postgres/wiki/pg#events
      pghelper.closeAll(this);

    },
    function() {

      console.log('kill connections')
      // this will then kill all existing connections
      var command = 'sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=' + "'" + settings.pg.database + "'" + ';" postgres';
      // var command = 'psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=' + "'" + settings.pg.database + "'" + ';" postgres'; // ### for local testing ###
      self.execute(command, this);

    },
    function(){

      console.log('drop database')
      var command = 'sudo -u postgres psql -c "DROP DATABASE ' + settings.pg.database + ';" postgres';
      // var command = 'psql -c "DROP DATABASE ' + settings.pg.database + ';" postgres'; // ### for local testing ###
      self.execute(command, this);


    },
    function() {

      console.log('create database')
      // create a new db

      // ## for deployment
      //var command = 'sudo -u postgres createdb -O ubuntu '+ settings.pg.database;
      // ## for local testing
      var command = 'createdb '+ settings.pg.database;
      self.execute(command, this);

    },
    function() {

      console.log('add postgis extensions')
      var sql = "CREATE EXTENSION postgis; CREATE EXTENSION postgis_topology;"
      pghelper.query(sql, this);

    },
    function() {

      // restore the db from the backup
      var command = "psql " + settings.pg.database + " < " + self.filePath;
      self.execute(command, this);

    },
    function() {

      console.log('done!')
      cb(null, self.filePath);

    }
  );

  refresh();

}

PostGresRefresh.prototype.execute = function(command, cb){
  exec(command, function(error, stdout, stderr){
    cb(error, stdout);
  });
}


PostGresRefresh.prototype.fetchBackup = function(cb){


  var self = this;

  var listParams = {
    Bucket: settings.s3.backupbucket
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
        Bucket: settings.s3.backupbucket,
        Key: mostRecent.Key
      };


      self.filePath =  path.join(appRoot, 'backups', getParams.Key); // save this value for use between functions in the flow
      console.log("filePath:  " + self.filePath);

      // get the names of files in the backups folder
      fs.readdir(path.join(appRoot, 'backups'), function(err, files){
        if(err) { console.log(err); }
        // check that the file on S3 is different
        if(files.indexOf(getParams.Key) > -1) {
          console.log('most recent file already fetched');
          cb();
        } else {
          // delete the old file
          files.forEach(function(element, index){
            var elementExt = path.extname(element);
            // delete only files with the valid extensions
            if(valid_extensions.indexOf(elementExt) > -1){
              var elementPath = path.join(appRoot, 'backups', element);
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
            console.log('backup fetched');
            cb();
          });
        }
      });
    }
  });
}

module.exports = PostGresRefresh;
