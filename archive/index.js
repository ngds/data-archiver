var aws = require("aws-sdk");
var _ = require("underscore");
var fs = require("fs.extra");
var treeHash = require("treehash");
var blockStream = require("block-stream");
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
    var startTime = new Date();
    var partSize = 1024 * 1024;
    var treeHashStream = treeHash.createTreeHashStream();
    var block = new blockStream(partSize);
    var fileStream = fs.createReadStream(compressed);
    var params = {vaultName: vault, partSize: partSize.toString()}; 
    var rangeStart = 0;
    var rangeEnd = 0;

    glacier.initiateMultipartUpload(params, function (err, part) {
      if (err) callback(err);
      else console.log("Glacier upload ID: ", part.uploadId);

      fileStream.pipe(block);

      block.on("data", function (chunk) {
        rangeEnd += chunk.length;
        rangeStart = (rangeEnd - chunk.length);

        console.log(rangeStart, rangeEnd);

        var partParams = {
          vaultName: vault,
          uploadId: part.uploadId,
          range: "bytes " + rangeStart + "-" + rangeEnd + "/*",
          body: chunk,
        };
        glacier.uploadMultipartPart(partParams, function (upErr, upData) {
          if (upErr) callback(upErr);
          console.log("Completed part ", this.request.params.range);
        })
        treeHashStream.update(chunk);
      });
      
      block.on("end", function () {
        var totalTreeHash = treeHashStream.digest();
        var doneParams = {
          vaultName: vault,
          uploadId: part.uploadId,
          checksum: totalTreeHash,
        };

        console.log("Completing upload...");
        glacier.completeMultipartUpload(doneParams, function (cErr, cData) {
          if (cErr) {
            console.log("An error occurred while uploading the archive.");
            callback(cErr);
          } else {
            var delta = (new Date() - startTime) / 1000;
            console.log("Completed upload in", delta, "seconds");
            console.log("Archive ID:", cData.archiveId);
            console.log("Checksum:", data.checksum);
            callback(cData);
          }
        })
      });
    })
  },
};