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
  uploadToGlacier: function (uncompressed, compressed, vault, callback) {
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

    glacier.initiateMultipartUpload(params, function (err, res) {
      if (err) throw err;
      console.log("Glacier upload ID: ", res.uploadId);

      for (var i = 0; i < file.length; i += partSize) {
        var end = Math.min(i + partSize, file.length);
        var partParams = {
          vaultName: vault,
          uploadId: res.uploadId,
          range: "bytes " + i + "-" + (end-1) + "/*",
          body: file.slice(i, end),
        };

        glacier.uploadMultipartPart(partParams, function (uErr, data) {
          if (uErr) throw uErr;
          if (--numPartsLeft > 0) callback();

          var doneParams = {
            vaultName: vault,
            uploadId: res.uploadId,
            archiveSize: file.length.toString(),
            checkum: treeHash,
          }

          glacier.completeMultipartUpload(doneParams, function (cErr, cData) {
            if (cErr) callback(cErr);
            else callback(cData);
          })
        })
      }
    })
  },
};