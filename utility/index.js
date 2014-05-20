var fs = require("fs");
var path = require("path");
var url = require("url");

module.exports = {
  buildDirs: function (base) {
    var dirs = {};
    dirs["out"] = path.join(base, "outputs");
    dirs["record"] = path.join(dirs["out"], "records");
    dirs["archive"] = path.join(dirs["out"], "archive");
    dirs["logs"] = path.join(dirs["out"], "logs");

    for (var key in dirs) {
      if (fs.existsSync(dirs[key])) {
        console.log("Path exists: " + dirs[key]);
      } else {
        fs.mkdirSync(dirs[key]);
      }
    };
    return dirs;
  },
  buildUrl: function (endPoint, startPosition, maxRecords, callback) {
    var host = url.parse(endPoint)["host"],
      path = url.parse(endPoint)["path"],
      request = "GetRecords",
      service = "CSW",
      resultType = "results",
      elementSetName = "full",
      outputSchema = "http://www.isotc211.org/2005/gmd",
      typeNames = "gmd:MD_Metadata",
      version = "2.0.2";
    
    callback({
      host: host,
      path: path + "Request=" + request + "&service=" + service + "&resultType=" 
        + resultType + "&elementSetName=" + elementSetName + "&startPosition=" 
        + startPosition + "&maxRecords=" + maxRecords + "&outputSchema="
        + outputSchema + "&typeNames=" + typeNames + "&version=" + version
    })
  },
  doRequest: function (total, increment, callback) {
    this._scaleRequest(total, increment, function (response) {
      var counter = 1;
      var increment = response.increment;
      var holder = response.holder;
      var last = response.last;
      if (counter === 1) {
        callback({"counter": counter, "increment": increment});      
      }
      while (counter < holder) {
        counter += increment;
        callback({"counter": counter, "increment": increment});
      }
      if (counter === holder) {
        increment = (last - holder);
        callback({"counter": counter, "increment": increment});
      }
    })
  },
  _scaleRequest: function (total, increment, callback) {
    var counter = 1;
    while (counter < total) {
      counter += increment;
    }

    var holder = (counter-increment);
    var last = ((increment-(counter-total))+holder);

    if (typeof callback === "function") {
      callback({
        "increment": increment,
        "holder": holder,
        "last": last,
      })
    }
  }
}