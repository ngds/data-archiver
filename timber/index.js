var fs = require("fs");
var _ = require("underscore");
var path = require("path");
var async = require("async");

module.exports = {
  log: function (dirs, output, message, callback) {
  	var logs = {
      "ping": path.join(dirs["status"], "ping-logger.csv"),
      "process_all": path.join(dirs["status"], "process_all.txt"),
      "process_errors": path.join(dirs["status"], "process_errors.txt"),
      "error_records": path.join(dirs["status"], "error_records.xml"),
      "error_id": path.join(dirs["status"], "error_id.csv"),
    }

    fs.appendFile(logs[output], message, function () {
      callback();
    })
  },
  writePingStatus: function (dirs, data, callback) {
    var msg = data["csw"] + "," + data["id"] + "," 
      + data["linkage"] + data["status"] + ",\n";
    this.log(dirs, "ping", msg, function () {
      callback();
    })
  },
}