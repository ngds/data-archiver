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
  uploadToS3: function (compressed, callback) {
    aws.config.loadFromPath("./awsConfig.json");
    var s3 = new aws.S3({params: {Bucket: "ngds-archive"}});
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
  },
};