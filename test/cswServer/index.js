var express = require('express'),
    path = require('path'),
    app = express();

app.get('/csw', function (req, res, next) {
    if (req.query.Request) {
        switch (req.query.Request.toLowerCase()) {
            case 'getrecords':
                return res.download(path.join(__dirname, 'cswResponse.xml'));
                break;
            case 'getrecordbyid':
                if (req.query.id) {
                    return res.download(path.join(__dirname, 'sampleMetadata', req.query.id + '.iso.xml'));
                }
                break;
            default:
                break;
        }
    }

    next(new Error('invalid request'));
});

if (require.main === module) {
	app.listen(3011);
} 
else {
	var p;
	module.exports = {
		start: function (callback) {
			p = app.listen(3011);
			setTimeout(callback, 500);
		},
		stop: function (callback) {
			p.close();
			setTimeout(callback, 500);
		}
	};
}