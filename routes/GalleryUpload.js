// need to install imagemagick and graphicsmagick on your system

var fs = require('fs')
  , gm = require('gm');
var flow = require('flow');

var S3Helper = require("../routes/S3Helper.js");
var s3helper = new S3Helper();


var GalleryUpload = function() {

};

GalleryUpload.prototype.process = function(upload, cb) {

  var self = this;

  var processUploads = flow.define(

      function() {

        this.cb = cb;

        upload.time = new Date().getTime();
        // ### shrink large images down some

          var imgPath = upload.path;
          gm(imgPath)
            .resize('1000', '800', '>')
            // Use > to change the dimensions of the image only if its width or height exceeds the geometry specification.
            .write(imgPath, this)


      },
      function() {
        s3helper.uploadGalleryImage(upload, 'full', this);
      },
      function(){

        // ### create small square thumbnail

          var imgPath = upload.path;
          gm(imgPath)
            .resize('200', '200', '^')
            // Append a ^ to the geometry so that the image is resized while maintaining the aspect ratio of the image,
            // but the resulting width or height are treated as minimum values rather than maximum values.
            .gravity('Center')
            .crop('200', '200')
            .write(imgPath, this)


      },
      function() {
        s3helper.uploadGalleryImage(upload, 'thumb', this);
      },
      function(){
        console.log('did it!')
        this.cb();

      }

    );

    processUploads();

}

module.exports = GalleryUpload;
