var fs = require("fs");
var _ = require("underscore");

module.exports = {
  buildLogFiles: function (dirs, callback) {
	  var logs = {
	    "status": path.join(dirs["status"], "linkage-status.csv"),
	    "dead": path.join(dirs["status"], "dead-linkages.csv"),
	    "unique": path.join(dirs["status"], "unique-linkages.csv"),
	    "process_all": path.join(dirs["status"], "process_all.txt"),
	    "process_errors": path.join(dirs["status"], "process_errors.txt"),
	    "error_records": path.join(dirs["status"], "error_records.xml"),
	    "error_id": path.join(dirs["status"], "error_id.csv"),
	  }
  },
  log: function (output, callback) {
  	
  }
}