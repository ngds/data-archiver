var fs = require("fs");
var _ = require("underscore");
var path = require("path");
var async = require("async");

// An abstract function for writing the status of pings to an output
// CSV file.
function writePingStatus (filePath, data, callback) {
  var msg = data["time"] + "," + data["csw"] + "," + data["id"] + "," 
    + data["linkage"] + "," + data["status"] + ",\n";

  fs.appendFile(filePath, msg, function (err) {
    if (err) callback(err);
    else callback(null);
  })
}

exports.writePingStatus = writePingStatus;