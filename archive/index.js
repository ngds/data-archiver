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
  uploadToGlacier: function (dirs, uncompressed, compressed, vault, callback) {
    aws.config.loadFromPath("./awsConfig.json");
    var glacier = new aws.Glacier();
    var file = fs.readFileSync(compressed);

    var options = {
      vaultName: vault,
      body: file,
    }

    glacier.uploadArchive(options, function (error, response) {
      if (error) callback(error);
      else 
        var msg = "Uploaded :" + response.archiveId;
        fs.rmrf(uncompressed, function (error) {
          if (error) callback(error);
          fs.exists(compressed, function (exists) {
            if (exists) {
              fs.unlink(compressed, function (error) {
                if (error) callback(error);
                else callback(msg);
              })
            }
          })
        })
    })
  },
};