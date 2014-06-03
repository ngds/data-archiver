var fs = require("fs");
var _ = require("underscore");
var path = require("path");
var async = require("async");

module.exports = {
  log: function (dirs, output, message, callback) {
  	var logs = {
      "status": path.join(dirs["status"], "linkage-status.csv"),
      "process_all": path.join(dirs["status"], "process_all.txt"),
      "process_errors": path.join(dirs["status"], "process_errors.txt"),
      "error_records": path.join(dirs["status"], "error_records.xml"),
      "error_id": path.join(dirs["status"], "error_id.csv"),
    }

    fs.appendFile(logs[output], message, function (err) {
      if (err) callback(err);
      else callback(null);
    })
  },
  writeUrlStatus: function (dirs, store, callback) {
    var module = this;
    _.each(store["status"], function (item) {
      if (_.indexOf(store["unique"], item["linkage"]) === -1) {
        store["unique"].push(item["linkage"]);
        var msg = JSON.stringify(item) + ",\n";
        module.log(dirs, "status", msg, function (err, res) {
          if (err) callback(null, err);
          else callback(null);
        })
      }
    })
  }
}