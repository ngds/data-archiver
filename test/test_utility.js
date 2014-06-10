var utility = require("../utility"),
	fs = require("fs"),
	path = require("path");

// Tests for the utility module
module.exports = {

	// Test utility.buildDirs
	test_buildDirs: function (test){
		test.expect(2);
		var base = __dirname;
		utility.buildDirs(base);
		test.ok(fs.existsSync(path.join(base, "outputs", "records")), "directory outputs/record not created correctly");
		test.ok(fs.existsSync(path.join(base, "outputs", "status")), "directory outputs/archive not created correctly");
		test.done();
	},

	// Test utility.buildGetRecords
	test_buildGetRecords: function (test){
		test.expect(2);
		var base = "http://geothermaldata.org/csw?";
		utility.buildGetRecords(base, 10, 10, function (csw) {
			test.equal(csw.host, "geothermaldata.org", "host");
			test.equal(csw.path, "/csw?Request=GetRecords&service=CSW&resultType=results&elementSetName=full&startPosition=10&maxRecords=10&outputSchema=http://www.isotc211.org/2005/gmd&typeNames=gmd:MD_Metadata&version=2.0.2", "path");
			test.done();
		});
	}
	
};