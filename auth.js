var User = require('./routes/app').User;
var jwt = require('jwt-simple');
var tokenSecret = "thisissupersecret";

module.exports.auth = function(req, res, next) {
	var token = (req.body && req.body.token) || (req.query && req.query.token) || req.headers['x-access-token'];
	if (token) {
		try {
			req.token = token;
			var decoded = jwt.decode(token, tokenSecret);
 			if (decoded.exp <= Date.now()) {
  				res.end('Access token has expired', 400);
			}
			User.findOne({ email: decoded.iss }, function(err, user) {
				req.user = user;
				next();
			});
  		} catch (err) {
    		return next();
  		}
	} else {
	  	next();
	}

};

module.exports.tokenSecret = tokenSecret;