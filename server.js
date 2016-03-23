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
		usernameField:"username",
		passwordField:"password",
		passReqToCallback:true
	},
	function(req, username, password, done) {
        User.findOne({ 'username' :  username }, function(err, user) {
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
		eachAtIndex: function(array,index,options) {
			var lookup;
			if (array && (index != undefined)) {
				lookup = array[index];
			}
			var output = "";
			if (lookup && lookup.length) {
				for (var i=0;i<lookup.length;i++) {
					var value = {
						value: lookup[i]
					}
					value["$first"] = (i==0);
					value["$last"] = (i==lookup.length-1);
					value["$index"] = i;
					output += options.fn(value);
				}
			}
			return output;
		},
		logos: function() {
			var output = "";
			var files = fs.readdirSync("client/media/logos");
			for (var i=0;i<files.length;i++) {
				var file = files[i];
				output+="<img src='media/logos/"+file+"' class='logo'>";
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
		res.redirect(localConfig.application.nginxlocation);
	})
})

app.post('/user/login',passport.authenticate('local-login', {
    failureRedirect: localConfig.application.nginxlocation,
    failureFlash: true
}),function(req,res) {
	if (req.session.redirectTo) {
		res.redirect(req.session.redirectTo);
		delete req.session.redirectTo;
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/user/:username',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		switch(req.body["_method"]) {
			case "DELETE":
				ctrl.deleteUser(req,res);
			break;
			case "PUT":
				ctrl.updateUser(req,res);
			break;
			default:
				res.redirect(localConfig.application.nginxlocation);
			break;
		}
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/user',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		ctrl.createUser(req,res);
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/users',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		ctrl.getUsers(function(result) {
			res.render('listUsers',{
				user:req.user,
				users:result,
				location:localConfig.application.nginxlocation,
				opts:localConfig.page,
				error:req.flash("createMessage") || req.flash("editMessage") || req.flash("deleteMessage"),
				success:req.flash("successMessage"),
				edit:req.query.edit
			});
		})
	} else {
		req.session.redirectTo = "users";
		res.redirect(localConfig.application.nginxlocation);
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

app.get('/',function (req,res) {
	res.render('home',{
		user:req.user,
		location:localConfig.application.nginxlocation,
		opts:localConfig.page,
		error:req.flash("loginMessage")
	});
})

var PostGresRefresh = require("./routes/postGresRefresh.js");
var pgRefresh = new PostGresRefresh();

app.post('/refresh', function (req,res){
	if (req.user && req.user.permissions == "super"){
		pgRefresh.run(function(err,data){
			console.log("done db refresh");
			res.end('Ran db refresh');
		});
	}
})

// dashboard pages using a postgres connection
var PostGresHelper = require("./routes/postGresHelper.js");
var pghelper = new PostGresHelper();

app.get('/progress',function(req,res) {
	if (req.user) {
	    res.render('progress', {
				user:req.user,
				location:localConfig.application.nginxlocation,
	      opts:localConfig.page,
				error:req.flash("loginMessage")
	    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/progress', function (req,res){
	if (req.user){
		var queryStr = 'SELECT * FROM "INDICATOR_TRACKING_TABLE";';
		pghelper.query(queryStr, function(err, data){
			res.send(data);
		})
	}
})

app.get('/hardware',function(req,res) {
	if (req.user) {
	    res.render('hardware', {
				user:req.user,
				location:localConfig.application.nginxlocation,
	      opts:localConfig.page,
				error:req.flash("loginMessage")
	    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/hardware', function (req,res){
	if (req.user){
		var queryStr = 'SELECT * FROM "HARDWARE_INDICATORS";';
		pghelper.query(queryStr, function(err, data){
			res.send(data);
		})
	}
})

app.get('/software',function(req,res) {
	if (req.user) {
	    res.render('software', {
				user:req.user,
				location:localConfig.application.nginxlocation,
	      opts:localConfig.page,
				error:req.flash("loginMessage")
	    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/software', function (req,res){
	if (req.user){
		var queryStr = 'SELECT * FROM "SOFTWARE_INDICATORS";';
		pghelper.query(queryStr, function(err, data){
			res.send(data);
		})
	}
})


app.get('/query/:queryStr',function(req,res) {
	if (req.user && req.params.queryStr) {
		pghelper.query(req.params.queryStr, function(err, data){
			res.send(data);
		})
	}
})

app.get('/households',function(req,res) {
	if (req.user) {
		pghelper.query('SELECT * FROM "HOUSEHOLD";', function(err, data){
	    res.render('household', {
				user:req.user,
				location:localConfig.application.nginxlocation,
	      opts:localConfig.page,
	      pgdata:data,
				error:req.flash("loginMessage")
	    });
	  });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/households-map',function(req,res) {
	if (req.user) {
		pghelper.query('SELECT * FROM "HOUSEHOLD";', function(err, data){
	    res.render('households-map', {
				user:req.user,
				location:localConfig.application.nginxlocation,
	      opts:localConfig.page,
	      pgdata:data,
				error:req.flash("loginMessage")
	    });
	  });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/ccg',function(req,res) {
	if (req.user) {
    res.render('ccg', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/core-shelter',function(req,res) {
	if (req.user) {
    res.render('core-shelter', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/sted',function(req,res) {
	if (req.user) {
    res.render('sted', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/spot-maps',function(req,res) {
	if (req.user) {
    res.render('spot-maps', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})



app.listen(localConfig.application.port);
console.log('Listening on port '+localConfig.application.port);
