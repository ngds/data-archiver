var utility = require("../utility"),
	http = require("http");

// Tests not particular to any module
module.exports = {

	// Test live server for response
	test_liveGeothermaldataCswUrl: function (test){
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
	}
	
};