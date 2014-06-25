var fs = require("fs");
var _ = require("underscore");
var path = require("path");
var async = require("async");


function log (dirs, output, message, callback) {
  var logs = {
    "ping": path.join(dirs["status"], "ping-logger.csv"),
    "host": path.join(dirs["status"], "host-logger.csv"),
    "process_all": path.join(dirs["status"], "process_all.txt"),
    "process_errors": path.join(dirs["status"], "process_errors.txt"),
    "error_records": path.join(dirs["status"], "error_records.xml"),
  };

  fs.appendFile(logs[output], message, function (err) {
    if (err) callback(err);
    else callback(null);
  })
};

function writePingStatus (dirs, data, callback) {
  var msg = data["time"] + "," + data["csw"] + "," + data["id"] + "," 
    + data["linkage"] + "," + data["status"] + ",\n";
  this.log(dirs, "ping", msg, function (err) {
    if (err) callback(err);
    else callback(null, data["linkage"]);
  })
};

function writeHostStatus (dirs, data, callback) {
  var msg = data["time"] + "," + data["csw"] + "," + data["id"] + "," 
    + data["linkage"] + "," + data["status"] + ",\n";
  this.log(dirs, "host", msg, function (err) {
    if (err) callback(err);
    else callback(null, data["linkage"]);
  })
};

exports.log = log;
exports.writePingStatus = writePingStatus;
exports.writeHostStatus = writeHostStatus;