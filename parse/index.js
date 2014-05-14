var http = require("http"),
  fs = require("fs"),
  xmlStream = require("xml-stream");

module.exports = {
  scaleRequest: function (increment, parameters, callback) {
    var counter = 0,
      total;

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
  parseCsw: function (parameters, callback) {
    http.get(parameters).on("response", function (response) {
      var xml = new xmlStream(response, "utf-8");

      xml.collect("gmd:MD_Distribution");
      xml.on("updateElement: gmd:MD_Metadata", function (results) {
        var fileId = results["gmd:fileIdentifier"]["gco:CharacterString"],
          dist = results["gmd:distributionInfo"]["gmd:MD_Distribution"];

          if (typeof callback === "function") {
            callback({
              "id": fileId,
              "dist": dist,
              "record": results,
            });            
          }
      });
    }).end();
  },
  writeLocalFile: function (response) {
    var outputFile = "./outputs/" + response.id + ".json",
      data = JSON.stringify(response);

    fs.writeFile(outputFile, data, function (err) {
      if (err) {
        console.log(err);
      } else {
        console.log("File saved: " + outputFile);
      }
    })
  },
  pingUrl: function (response) {
    var dist = response.dist[0]["gmd:transferOptions"];
    if (dist) {
      var link = dist["gmd:MD_DigitalTransferOptions"]["gmd:onLine"]
        ["gmd:CI_OnlineResource"]["gmd:linkage"]["gmd:URL"];
      console.log(link);
    }
  },
  buildDirectory: function () {
  }
};