var utility = require("../utility"),
	http = require("http"),
	parse = require("../parse"),
  server = require('./cswServer');

// Test utility.buildUrl
exports.test_buildUrl = function (test){
	test.expect(2);
	var base = "http://geothermaldata.org/csw?";
	utility.buildUrl(base, 10, 10, function (csw) {
		test.equal(csw.host, "geothermaldata.org", "host");
		test.equal(csw.path, "/csw?Request=GetRecords&service=CSW&resultType=results&elementSetName=full&startPosition=10&maxRecords=10&outputSchema=http://www.isotc211.org/2005/gmd&typeNames=gmd:MD_Metadata&version=2.0.2", "path");
		test.done();
	});
};

// Test live server for response
exports.test_liveGeothermaldataCswUrl = function (test){
	test.expect(1);
	var base = "http://geothermaldata.org/csw?";
	utility.buildUrl(base, 10, 10, function (csw) {
		var options = {
			host: csw.host,
			port: 80,
			path: csw.path
		};
		http.get(options, function (res) {
			test.equal(res.statusCode, 200, "should get a 200 back from " + csw.host + csw.path);
			test.done();
		});
	});
};

// Test parse.parseCsw
exports.test_parseCsw = function (test){
	test.expect(6);
	// Start a local "csw server"
	server.start(function () {
		var getRecordUrl = {
			host: "localhost:3011",
			path: "/csw?Request=GetRecords&service=CSW&resultType=results&elementSetName=full&startPosition=10&maxRecords=10&outputSchema=http://www.isotc211.org/2005/gmd&typeNames=gmd:MD_Metadata&version=2.0.2"
		};
		parse.parseCsw(getRecordUrl, function (data) {
			// Test for the number of records returned
			test.equal(3, data.length, "should be 3 records");
			// Test the returned file Ids
			test.equal("f45943f40af01ba4512004cf04f47600", data[0].fileId, "1st record fileId should be f45943f40af01ba4512004cf04f47600"); 
			test.equal("f45943f40af01ba4512004cf04f3f6d0", data[1].fileId, "2nd record fileId should be f45943f40af01ba4512004cf04f3f6d0");
			test.equal("df0dbda5ca192cb6d9df00e41717010e", data[2].fileId, "3rd record fileId should be df0dbda5ca192cb6d9df00e41717010e");
			// Test some of the returned linkages
			test.equal("http://www.oregongeology.org/arcgis/rest/services/Public/ORPhysicalSamples/MapServer", data[0].linkages[0], "1st record, 1st linkage should be http://www.oregongeology.org/arcgis/rest/services/Public/ORPhysicalSamples/MapServer");
			test.equal("http://repository.stategeothermaldata.org/metadata/record/df0dbda5ca192cb6d9df00e41717010e/file/tn_yr3_tennessee_2013_geologic_maps_metadata_task2029_01232014.xls", data[2].linkages[0], "1st record, 1st linkage should be http://repository.stategeothermaldata.org/metadata/record/df0dbda5ca192cb6d9df00e41717010e/file/tn_yr3_tennessee_2013_geologic_maps_metadata_task2029_01232014.xls");
			server.stop(function () {});
			test.done();
		});
	});
};