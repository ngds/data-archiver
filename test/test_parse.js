var parse = require("../parse"),
  server = require('./cswServer');

// Tests for the parse module
module.exports = {

	// Test parse.parseCsw
	test_parseCsw: function (test){
		test.expect(2);
		// Start a local csw server
		server.start(function () {
			var getRecordUrl = "http://localhost:3011/csw?Request=GetRecords&service=CSW&resultType=results&elementSetName=full&startPosition=1&maxRecords=1&outputSchema=http://www.isotc211.org/2005/gmd&typeNames=gmd:MD_Metadata&version=2.0.2";
			parse.parseCsw(getRecordUrl, function (data) {
				if (!data["next"]) {
					// Test the returned file Id
					test.equal("b0f4ce5e-91ab-30db-9292-f146dc853891", data.fileId, "Record fileId should be b0f4ce5e-91ab-30db-9292-f146dc853891"); 
					// Test one of the returned linkages
					test.equal("http://www.osti.gov/geothermal/servlets/purl/7369635-5AlstN/", data.linkages[0], "1st linkage should be http://www.osti.gov/geothermal/servlets/purl/7369635-5AlstN/");
					}
				server.stop(function () {});
				test.done();
			});
		});
	}
	
};