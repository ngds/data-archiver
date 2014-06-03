var fs = require("fs");
var _ = require("underscore");
var path = require("path");

module.exports = {
  log: function (dirs, output, message, callback) {
  	var logs = {
      "status": path.join(dirs["status"], "linkage-status.csv"),
      "dead": path.join(dirs["status"], "dead-linkages.csv"),
      "unique": path.join(dirs["status"], "unique-linkages.csv"),
      "process_all": path.join(dirs["status"], "process_all.txt"),
      "process_errors": path.join(dirs["status"], "process_errors.txt"),
      "error_records": path.join(dirs["status"], "error_records.xml"),
      "error_id": path.join(dirs["status"], "error_id.csv"),
    }

    var log = fs.createWriteStream(logs[output], {flags: "a"});
    log.write(message);
    log.on("close", function () {
      callback(null, "Wrote log: " + logs[output]);
    });
    log.on("error", function (error) {
      callback(error);
    })
  },
  smartLog: function (store, callback) {
    
  },
  writeUrlStatus: function (dirs, store, callback) {
    var module = this;
    async.series([
      one: function (callback) {
        module.log(dirs, "unique", store["unique"], function (err, res) {
          if (err) callback(null, err);
          else callback(null);
        })
      },
      two: function (callback) {
        module.log(dirs, "status", store["status"], function (err, res) {
          if (err) callback(null, err);
          else callback(null);
        })
      },
      three: function (callback) {
        module.log(dirs, "dead", store["dead"], function (err, res) {
          if (err) callback(null, err);
          else callback(null);
        })
      }
    ], function (error, results) {
      if (error) callback(error);
      callback(results);
    })
  }
}