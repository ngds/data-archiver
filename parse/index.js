var http = require("http"),
  xmlStream = require("xml-stream");

module.exports = {
  scaleRequest: function (parameters, callback) {
    var counter = 0,
      total,
      increment = 100;

    http.get(parameters).on("response", function (response) {
      var xml = new xmlStream(response, "utf-8");
      xml.on("endElement: csw:SearchResults", function (results) {
        total = results.$.numberOfRecordsMatched
        while (counter < total) {
          counter += increment;
        }
    
        var placeHolder = (counter-increment),
        lastRecord = ((increment-(counter-total))+placeHolder);

        if (typeof callback === "function") {
        callback({
            "increment": increment,
            "placeHolder": placeHolder,
            "lastRecord": lastRecord,
          })
        }
      })
    }).end();
  },
  parseCsw: function () {
    scaleRequest(function (response) {
      console.log(response);
    })
  }
};