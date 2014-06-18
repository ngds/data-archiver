var fs = require("fs");
var path = require("path");
var url = require("url");
var _ = require("underscore");

function buildDirs (base) {
  var dirs = {};
  dirs["out"] = path.join(base, "outputs");
  dirs["record"] = path.join(dirs["out"], "records");
  dirs["status"] = path.join(dirs["out"], "status");

  for (var key in dirs) {
    if (fs.existsSync(dirs[key])) {
      console.log("Path exists: " + dirs[key]);
    } else {
      fs.mkdirSync(dirs[key]);
    }
  };
  return dirs;
};

function buildGetRecords (base, start, max, callback) {
  var host = url.parse(base)["host"];
  var path = url.parse(base)["path"];
  var request = "GetRecords";
  var service = "CSW";
  var resultType = "results";
  var elementSetName = "full";
  var outputSchema = "http://www.isotc211.org/2005/gmd";
  var typeNames = "gmd:MD_Metadata";
  var version = "2.0.2";
  
  callback({
    host: host,
    path: path + "Request=" + request + "&service=" + service + "&resultType=" 
      + resultType + "&elementSetName=" + elementSetName + "&startPosition=" 
      + start + "&maxRecords=" + max + "&outputSchema="
      + outputSchema + "&typeNames=" + typeNames + "&version=" + version
  })
};

function longWalk (parent, callback) {
  var module = this;
  var sanityParent = String(parent);
  module.walkDirectory(sanityParent, function (folders) {
    var full = _.map(folders, function (folder) {
      var sanityFolder = String(folder);
      return path.join(sanityParent, sanityFolder);
    });
    callback(full);
  })
};

function walkDirectory (path, callback) {
  fs.readdir(path, function (err, res) {
    if (err) callback(err);
    else callback(res);
  })
};

exports.buildDirs = buildDirs;
exports.buildGetRecords = buildGetRecords;
exports.longWalk = longWalk;