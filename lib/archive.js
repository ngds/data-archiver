var aws = require("aws-sdk");
var _ = require("underscore");
var fs = require("fs.extra");
var timber = require("./timber");


function uploadToS3 (compressed, s3Bucket, callback) {
  aws.config.loadFromPath("./awsConfig.json");
  var s3 = new aws.S3({params: {Bucket: s3Bucket}});
  fs.readFile(compressed, function (err, res) {
    if (err) callback(err);
    else {
      var s3Path = compressed.split("/outputs/records/")[1];
      var data = {Key: String(s3Path), Body: res};
      s3.putObject(data, function (err, data) {
        if (err) callback(err);
        else callback(data);
      })        
    }
  })
}

exports.uploadToS3 = uploadToS3;