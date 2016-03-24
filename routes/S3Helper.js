var pg = require('pg');
var settings = require('../config');
var path = require('path');
var fs = require('fs');
var flow = require('flow');

var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var S3Helper = function() {

};

S3Helper.prototype.listGallery = function(cb) {

  var listParams = {
    Bucket: settings.application.mediabucket,
    Prefix: 'gallery'
  };

  console.log(listParams);
  s3.listObjects(listParams, function(err, data) {
    if(err){
      console.log(err, err.stack); // an error occurred
    }
    // console.log(data);
    cb(err, data.Contents);
  });

}

S3Helper.prototype.uploadGalleryImage = function(filePath, cb) {

  var body = fs.createReadStream(filePath);
  var key = "gallery/" + path.basename(filePath);

  s3.upload({Body: body, Bucket: settings.application.mediabucket, Key: key}).
    on('httpUploadProgress', function(evt) {
      //console.log(evt);
    }).
    send(function(err, data) {
      fs.unlinkSync(filePath);
      cb(err, data)
    });

}

S3Helper.prototype.removeGalleryFile = function(keyArray, cb) {

  var removal = flow.define(
    function(){
      this.cb = cb;
      for(var i in keyArray){
        console.log(keyArray[i])
        var deleteParams = {  Bucket: settings.application.mediabucket, Key: keyArray[i] };
        s3.deleteObject(deleteParams, this.MULTI());
      }
    },
    function(){
      console.log('deleted!')
      this.cb();
    }
  );
  removal();

}

module.exports = S3Helper;
