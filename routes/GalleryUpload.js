// need to install imagemagick and graphicsmagick on your system

var fs = require('fs')
  , gm = require('gm');
var flow = require('flow');

var S3Helper = require("../routes/S3Helper.js");
var s3helper = new S3Helper();


var GalleryUpload = function() {

};

GalleryUpload.prototype.process = function(uploads, cb) {

  var self = this;

  var processUploads = flow.define(

      function() {

        this.cb = cb;

        // ### shrink large images down some
        for(var item in uploads){
          var imgPath = uploads[item].path;
          gm(imgPath)
            .resize('1000', '800', '>')
            // Use > to change the dimensions of the image only if its width or height exceeds the geometry specification.
            .write(imgPath, this.MULTI())
        }

      },
      function(){

        // ### create small square thumbnails
        for(var item in uploads){
          var imgPath = uploads[item].path;
          var thumbPath = imgPath.slice(0, imgPath.lastIndexOf(".")) + "_THUMB" + imgPath.slice(imgPath.lastIndexOf("."));
          gm(imgPath)
            .resize('200', '200', '^')
            // Append a ^ to the geometry so that the image is resized while maintaining the aspect ratio of the image,
            // but the resulting width or height are treated as minimum values rather than maximum values.
            .gravity('Center')
            .crop('200', '200')
            .write(thumbPath, this.MULTI())
        }

      },
      function(){

        for(var item in uploads){
          var imgPath = uploads[item].path;
          var thumbPath = imgPath.slice(0, imgPath.lastIndexOf(".")) + "_THUMB" + imgPath.slice(imgPath.lastIndexOf("."));
          s3helper.uploadGalleryImage(imgPath, this.MULTI())
          s3helper.uploadGalleryImage(thumbPath, this.MULTI())
        }

      },
      function(){
        console.log('did it!')
        this.cb();

      }

    );

    processUploads();

}

module.exports = GalleryUpload;
