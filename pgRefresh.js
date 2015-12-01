// * * * * * * * * * *
// * * * * * * * * * *
// not sure where this goes yet
// * * * * * * * * * *
// * * * * * * * * * *





var AWS = require('aws-sdk'),
path = require('path'),
fs = require('fs'),
zlib = require('zlib')
pg = require('pg'),
settings = require(path.join(__dirname, 'settings/settings.js')),
spawn = require('child_process').spawn,
flow = require('flow'),
CronJob = require('cron').CronJob;

AWS.config.region = 'us-west-2';
var s3 = new AWS.S3();


// * * * need to figure out where in the app folder structure the db refresh code should go
// * * * need to understand flow and callbacks
// * * * also how to break out the sql queries for the dropdatabase into seperate modules/helpers/functions/things

// https://github.com/willconant/flow-js
var refresh = flow.define(
  function() {
    fetchBackup(this);
  },
  function() {
    killConnections(this);
  },
  function() {
    dropDatabase(this);
  },
  function() {
    createDatabase(this);
  },
  function() {
    restoreDatabase(this);
  },
  function() {
    console.log("refresh complete");
  }
);


function fetchBackup(cb) {
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
      cb.filePath =  path.join(__dirname, 'backups', getParams.Key); // save this value for use between functions in the flow

      // get the names of files in the backups folder
      fs.readdir(path.join(__dirname, 'backups'), function(err, files){
        if(err) { console.log(err); }
        // check that the file on S3 is different
        if(files.indexOf(getParams.Key) > -1) {
          console.log("most recent file already fetched");
          cb.haveFile = "yes";
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
          var out = fs.createWriteStream(cb.filePath);
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

function killConnections(cb){
  // save this string for use between functions in the flow
  cb.conString = "postgres://" +
  settings.pg.user + ":" +
  settings.pg.password + "@" +
  settings.pg.server + ":" +
  settings.pg.port + "/" +
  "postgres";

  // this will prevent connections to the database and
  var sql = "UPDATE pg_database " +
  "SET datallowconn = 'false' " +
  "WHERE datname = '" + settings.pg.database + "'; " +
  // this will then kill all existing connections
  "SELECT pg_terminate_backend (pg_stat_activity.pid) " +
  "FROM pg_stat_activity " +
  "WHERE pg_stat_activity.datname = '" + settings.pg.database + "';";
  pg.connect(cb.conString, function(err, client, done) {
    if (err) {
      console.error('error fetching client from pool', err);
    }
    client.query(sql, function (queryerr, result) {
      //call `done()` to release the client back to the pool
      done();
      if (queryerr) {
        console.error('ERROR RUNNING QUERY:', sql, queryerr);
      }
      console.log("disconnectKill completed");
      cb();
    });
  });
}

function dropDatabase(cb) {
  // this will drop the db
  var sql = "DROP DATABASE IF EXISTS " + settings.pg.database + ";";
  pg.connect(cb.conString, function(err, client, done) {
    if (err) {
      console.error('error fetching client from pool', err);
    }
    client.query(sql, function (queryerr, result) {
      //call `done()` to release the client back to the pool
      done();
      if (queryerr) {
        console.error('ERROR RUNNING QUERY:', sql, queryerr);
      }
      console.log("dropDatabase completed");
      cb();
    });
  });
}

function createDatabase(cb) {
  creating = spawn('createdb', [settings.pg.database]);
  console.log('createdb', ' ', settings.pg.database);
  creating.stdout.on('data', function (data) {
    console.log('stdout: ' + data);
  });
  creating.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
  });
  creating.on('close', function (code) {
    console.log('createdb process exited with code ' + code);
    cb();
  });
}

function restoreDatabase(cb) {
  console.log("restore process: " + settings.pg.database);
  console.log("restore process: " + cb.filePath);

  restoring = spawn('psql', [settings.pg.database, '-f', cb.filePath]);
  restoring.stdout.on('data', function (data) {
    // console.log('stdout: ' + data);
  });
  restoring.stderr.on('data', function (data) {
    // console.log('stderr: ' + data);
  });
  restoring.on('close', function (code) {
    console.log('restore process exited with code ' + code);
    cb();
  });
}

refresh();


// // schedule the database refresh
// new CronJob('0 17 * * *', function() {
//   console.log("It's five o'clock somewhere.");
//   refresh();
// }, null, true, 'America/New_York');
