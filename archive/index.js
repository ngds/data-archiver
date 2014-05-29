var aws = require('aws-sdk');
var _ = require("underscore");

aws.config.loadFromPath('./awsConfig.json');
var glacier = new aws.Glacier();

module.exports = {
  checkGlacierVaults: function (vault, callback) {
    var module = this;
    glacier.listVaults(function (error, data) {
      if (error) callback(error, error.stack);
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
            if (error) callback(error);
            else callback(vault);
          });
        }
      } else {
        glacier.createVault({vaultName: vault}, function (error) {
          if (error) callback(error);
          else callback(vault);
        });
      }
    });
  },
  uploadToGlacier: function (vault, callback) {
    var buffer = new Buffer(2.5 * 1024 * 1024);
  },
};