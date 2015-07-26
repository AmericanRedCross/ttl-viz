//General config
var flash = require('connect-flash');
var localConfig = require('./config');
var AppCtrl = require('./routes/app').Ctrl;
var Asset = require('./routes/app').Asset;
var moment = require('moment');
var fs = require('fs');


var ctrl = new AppCtrl('localhost', 27017);


//Authentication config
var User = require('./routes/app').User;
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var JWT = require('jwt-simple');
var jwtauth = require('./auth.js');

passport.use('local-login',new LocalStrategy({
		usernameField:"email",
		passwordField:"password",
		passReqToCallback:true
	},
	function(req, email, password, done) {
        User.findOne({ 'email' :  email }, function(err, user) {
            if (err) {
                return done(err);
            }
            if (!user || !user.validPassword(password)) {
                return done(null, false, req.flash('loginMessage', 'Invalid username or password.'));
            }
            return done(null, user);
        });

    }
))

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//Express config
var express = require('express');
var exphbs  = require('express3-handlebars');
var multer  = require('multer');
var morgan  = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var app = express();

app.use(morgan('dev'));     /* 'default', 'short', 'tiny', 'dev' */
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(multer());
app.use(cookieParser());
app.use(session({
  secret: 'thisissecret',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.set("tokenSecret",jwtauth.tokenSecret);
app.set("json spaces",4);

app.engine('handlebars', exphbs({
	defaultLayout: 'main',
	helpers: {
		eq: function(v1,v2,options) {
			if (v1 && v2 && v1.toString() === v2.toString()) {  
				return options.fn(this);
			}
			return options.inverse(this);
		},
		neq: function(v1,v2,options) {
			if (v1 && v2 && v1.toString() !== v2.toString()) {  
				return options.fn(this);
			}
			return options.inverse(this);
		},
		log: function(context,options) {
			console.log(context);
			return true;
		},
		json: function(context) {
			return JSON.stringify(context);
		},
		string: function(context) {
			return context.toString();
		},
		formatDate: function(context,format) {
			return moment(context).format(format);
		},
		logos: function() {
			var output = "";
			var files = fs.readdirSync("client/media/logos");
			for (var i=0;i<files.length;i++) {
				var file = files[i];
				output+="<img src='/media/logos/"+file+"' class='logo'>";
			}
			return output;
		}
	},
	partials: {
		
	}
}))
app.set('view engine', 'handlebars');

app.use(express.static('client'));

app.post('/user/logout',function(req,res) {
	req.session.destroy(function() {
		res.redirect("/");
	})
})

app.post('/user/login',passport.authenticate('local-login', { 
    failureRedirect: '/',
    failureFlash: true
}),function(req,res) {
	if (req.session.redirectTo) {
		res.redirect(req.session.redirectTo);
		delete req.session.redirectTo;
	} else {
		res.redirect("/");
	}
})

app.post('/user/:email',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		switch(req.body["_method"]) {
			case "DELETE":
				ctrl.deleteUser(req,res);
			break;
			case "PUT":
				ctrl.updateUser(req,res);
			break;
			default:
				res.redirect("/");
			break;
		}
	} else {
		res.redirect("/");
	}
})

app.post('/user',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		ctrl.createUser(req,res);
	} else {
		res.redirect("/");
	}
})

app.get('/users',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		ctrl.getUsers(function(result) {
			res.render('listUsers',{
				user:req.user,
				users:result,
				opts:localConfig,
				error:req.flash("createMessage") || req.flash("editMessage") || req.flash("deleteMessage"),
				success:req.flash("successMessage"),
				edit:req.query.edit
			});
		})
	} else {
		req.session.redirectTo = "/users";
		res.redirect("/");
	}
})

app.post('/users/import',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		if (req.files && req.files.import) {
			ctrl.importCSV(req,res,"user");
		}		
	} else {
		res.status(401).send();
	}
})

app.get('/users/export',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		ctrl.exportData(req,res,"user");
	} else {
		res.status(401).send();
	}
})

app.post('/asset/:id',function(req,res) {
	if (req.user) {
		var opts = { '_id' :  req.params.id };
		if (req.user.permissions != "super") {
			opts.user = req.user.email;
		}
		switch(req.body["_method"]) {
			case "DELETE":
				ctrl.deleteAsset(req,res,opts);
			break;
			case "PUT":
				ctrl.updateAsset(req,res,opts);
			break;
			default:
				res.redirect("/");
			break;
		} 
	} else {
		res.redirect("/");
	}
})

app.post('/asset',function(req,res) {
	if (req.user) {
		ctrl.createAsset(req,res);
	} else {
		res.redirect("/");
	}
})

app.post('/assets/import',function(req,res) {
	if (req.user) {
		if (req.files && req.files.import) {
			ctrl.importCSV(req,res,"asset");
		}		
	} else {
		res.redirect("/");
	}
})

app.get('/assets/export',function(req,res) {
	if (req.user) {
		ctrl.exportData(req,res,"asset");
	} else {
		res.redirect("/");
	}
})

app.get('/assets',function(req,res) {
	if (req.user) {
		ctrl.getAssets(req.user,{},function(result) {
			res.render('listAssets',{
				user:req.user,
				assets:result,
				opts:localConfig,
				error:req.flash("createMessage") || req.flash("editMessage") || req.flash("deleteMessage"),
				success:req.flash("successMessage"),
				edit:req.query.edit
			});
		})
	} else {
		req.session.redirectTo = "/assets";
		res.redirect("/");
	}
})


function apiSucceed(req,payload) {
	var data = {
		success: true,
		response: payload
	}
	if (req.user) {
		if (!data.auth) {
			data.auth = {
				user:req.user.email
			}
		} else {
			data.auth.user = req.user.email;
		}
	}
	if (req.token) {
		if (!data.auth) {
			data.auth = {
				token:req.token
			}
		} else {
			data.auth.token = req.token;
		}
	}
	return data;
}

function apiFail(err) {
	return { 
		success: false,
		error: err
	}
}

app.get('/api/authenticate', function(req, res) {
	res.render('apiAuth',{
		error:req.flash("createMessage") || req.flash("editMessage") || req.flash("deleteMessage"),
		opts:localConfig
	});
})

app.post('/api/authenticate', function(req, res) {
  passport.authenticate('local-login', function(err, user, info) {
    if (!user || err) {
    	if (req.query.from) {
    		res.redirect("http://"+req.query.from+"?token=INVALID");
    	} else {
    		res.status(401).json(apiFail("Invalid username and/or password."));
    	}
    } else {    
	    var token = JWT.encode({ iss: user.email, exp: moment().add('hours', 24).valueOf()}, app.get('tokenSecret'));
	    if (req.query.from) {
	    	res.redirect("http://"+req.query.from+"?token="+token);
	    } else {
	    	res.json(apiSucceed(req,{token: token}));
	    }
    }
  })(req, res);
});

app.get('/api/user/:email',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	if (req.user && (req.user.permissions == "super" || req.user.email == req.params.email)) {
		ctrl.getUser(req.params.email,function(user) {
			if (user) {				
				res.json(apiSucceed(req,user));
			} else {
				res.status(400).json(apiFail("No user with that email address or insufficient access."))	
			}
		})
	} else {
		res.status(401).json(apiFail("Access denied."));
	}
})

app.get('/api/assets',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	ctrl.getAssets(req.user,req.query,function(result) {
		if (result && result.length) {
			for(var i=0;i<result.length;i++) {
				delete result[i].__v;
				delete result[i].user;
			}
			res.json(apiSucceed(req,result));
		} else {
			res.status(400).json(apiFail("No assets matching that query or insufficient access."))
		}
	})
})

app.get('/api/asset/:id/file',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	ctrl.getAssetFile(req.user,req.params.id,function() {
		res.status(404).send();
	},req,res)
})

app.get('/api/asset/:id/thumbnail/:size',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	ctrl.getAssetThumb(req.user,req.params.id,function() {
		res.status(404).send();
	},req,res)
})

app.get('/api/asset/:id/thumbnail',[jwtauth.auth],function(req,res) {
	res.redirect("/api/asset/"+req.params.id+"/thumbnail/500");
})

app.get('/api/asset/:id',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	ctrl.getAsset(req.user,req.params.id,function(asset) {
		if (asset) {
			delete asset.__v;
			delete asset.user;
			res.json(apiSucceed(req,asset));
		} else {
			res.status(400).json(apiFail("No asset matching that ID or insufficient access."));
		}
	})
})

app.get('/',function (req,res) {
	res.render('home',{
		user:req.user,
		opts:localConfig,
		error:req.flash("loginMessage")
	});
})		

 
app.listen(localConfig.port);
console.log('Listening on port '+localConfig.port);