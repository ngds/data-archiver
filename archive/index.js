var aws = require("aws-sdk");
var _ = require("underscore");
var fs = require("fs.extra");
var timber = require("../timber");

module.exports = {
  checkGlacierVaults: function (dirs, vault, callback) {
    var module = this;
    glacier.listVaults(function (error, data) {
      if (error) callback(error);
      var vaultList = data["VaultList"];
      if (vaultList !== null) {
        var vaults = [];
        var vaultCheck = _.each(vaultList, function (data) {
          var vaultName = data["VaultName"];
          vaults.push(vaultName);
        })
        if (_.indexOf(vaults, vault) > -1) {
          callback(vault);
        } else {
          glacier.createVault({vaultName: vault}, function (error) {
            if (error) {
              callback(error);
            } else {
              callback(vault);          
            }
          });
        }
      } else {
        glacier.createVault({vaultName: vault}, function (error) {
          if (error) {
            callback(error);
          } else {
            callback(vault);
          }
        });
      }
    });
  },
  uploadToGlacier: function (compressed, vault, callback) {
    aws.config.loadFromPath("./awsConfig.json");
    var glacier = new aws.Glacier();
    var file = fs.readFileSync(compressed);
    var partSize = 1024 * 1024;
    var startTime = new Date();
    var partNum = 0;
    var numPartsLeft = Math.ceil(file.length / partSize);
    var maxUploadTries = 3;
    var params = {vaultName: vault, partSize: partSize.toString()};

    var treeHash = glacier.computeChecksums(file).treeHash;

    console.log("Initiating upload to ", vault);
    glacier.initiateMultipartUpload(params, function (mpErr, multipart) {
      if (mpErr) { console.log("Error! ", mpErr); callback(mpErr); };
      console.log("Glacier upload ID: ", multipart.uploadId);

      for (var i = 0; i < file.length; i += partSize) {
        var end = Math.min(i + partSize, file.length);
        var partParams = {
          vaultName: vault,
          uploadId: multipart.uploadId,
          range: "bytes " + i + "-" + (end-1) + "/*",
          body: file.slice(i, end),
        };

        console.log("Uploading part ", i, "=", partParams.range);
        glacier.uploadMultipartPart(partParams, function (multiErr, mData) {
          if (multiErr) callback(multiErr);
          console.log("Completed part ", this.request.params.range);
          if (--numPartsLeft > 0) callback();

          var doneParams = {
            vaultName: vault,
            uploadId: multipart.uploadId,
            archiveSize: file.length.toString(),
            checksum: treeHash,
          }

          console.log("Completing upload...");
          glacier.completeMultipartUpload(doneParams, function (err, data) {
            if (err) {
              console.log("An error ocurred while uploading the archive");
              callback(err);
            } else { 
              var delta = (new Date() - startTime) / 1000;
              console.log("Completed upload in", delta, "seconds");
              console.log("Archive ID:", data.archiveId);
              console.log("Checksum:", data.checksum);
              callback(data);
            }
          })
        })
      }
    })
  },
};