var fs = require("fs");
var _ = require("underscore");

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
    };

    fs.appendFile(logs[output, message, function (error) {
  		if error callback(error);
  		else callback();
  	})
  }
}
