//General config
var flash = require('connect-flash');
var localConfig = require('./config');
var AppCtrl = require('./routes/app').Ctrl;
var Asset = require('./routes/app').Asset;
var moment = require('moment');
var fs = require('fs');

var path = require('path');
global.appRoot = path.resolve(__dirname);

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
	// limit: '50mb',
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
	console.log(req.body)
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

app.post('/asset/:id',function(req,res) {
	if (req.user) {
		var opts = { '_id' :  req.params.id };
		if (req.user.permissions != "super") {
			opts.user = req.user.username;
		}
		switch(req.body["_method"]) {
			case "DELETE":
				ctrl.deleteAsset(req,res,opts);
			break;
			case "PUT":
				ctrl.updateAsset(req,res,opts);
			break;
			default:
				res.redirect(localConfig.application.nginxlocation);
			break;
		}
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/asset',function(req,res) {
	if (req.user) {
		console.log(req.body)
		ctrl.createAsset(req,res);
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.post('/assets/import',function(req,res) {
	if (req.user) {
		if (req.files && req.files.import) {
			ctrl.importCSV(req,res,"asset");
		}
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/assets/export',function(req,res) {
	if (req.user) {
		ctrl.exportData(req,res,"asset");
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/list-assets',function(req,res) {
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
		console.log(localConfig.application.nginxlocation + "assets")
		req.session.redirectTo = localConfig.application.nginxlocation + "assets";
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
				user:req.user.username
			}
		} else {
			data.auth.user = req.user.username;
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
	    var token = JWT.encode({ iss: user.username, exp: moment().add('hours', 24).valueOf()}, app.get('tokenSecret'));
	    if (req.query.from) {
	    	res.redirect("http://"+req.query.from+"?token="+token);
	    } else {
	    	res.json(apiSucceed(req,{token: token}));
	    }
    }
  })(req, res);
});

app.get('/api/user/:username',[jwtauth.auth],function(req,res) {
	res.header('Access-Control-Allow-Origin', '*');
	if (req.user && (req.user.permissions == "super" || req.user.username == req.params.username)) {
		ctrl.getUser(req.params.username,function(user) {
			if (user) {
				res.json(apiSucceed(req,user));
			} else {
				res.status(400).json(apiFail("No user with that username or insufficient access."))
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
	res.redirect("api/asset/"+req.params.id+"/thumbnail/500");
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
		location:localConfig.application.nginxlocation,
		opts:localConfig.page,
		error:req.flash("loginMessage")
	});
})

app.get('/admin',function(req,res) {
	if (req.user && req.user.permissions == "super") {
		res.render('admin',{
			user:req.user,
			location:localConfig.application.nginxlocation,
			opts:localConfig.page,
			error:req.flash("loginMessage")
		});
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

var PostGresRefresh = require("./routes/postGresRefresh.js");
var postGresRefresh = new PostGresRefresh();

app.post('/refresh', function (req,res){
	if (req.user && req.user.permissions == "super"){
		postGresRefresh.run(function(err,data){
			res.send(data);
		});
	}
})

var GalleryUpload = require("./routes/GalleryUpload.js");
var galleryUpload = new GalleryUpload();

app.post('/uploadimg',function(req,res){

	console.log(req.files.file.path)
	galleryUpload.process(req.files.file, function(err,data){
		res.end('processed!');
	});

})

var S3Helper = require("./routes/S3Helper.js");
var s3helper = new S3Helper();

app.post('/gallery', function(req,res){
	if (req.user) {
		s3helper.listGallery(function(err,data){
			res.send(data);
		})
	} else {
		res.send('error')
	}
})

app.post('/remove-image', function (req,res){
	if (req.user && req.user.permissions == "super"){
		s3helper.removeGalleryFile(req.body.keyArray, function(err, data){
			res.end();
		})
	}
})

app.get('/gallery', function(req,res){
	if (req.user) {
			res.render('gallery', {
				user:req.user,
				location:localConfig.application.nginxlocation,
				opts:localConfig.page,
				error:req.flash("loginMessage")
			});
	} else {
		res.redirect(localConfig.application.nginxlocation);
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

app.post('/analytics', function (req,res){
	if (req.user){
		var queryStr = 'SELECT * FROM "PROGRAM_DOCUMENTS";';
		pghelper.query(queryStr, function(err, data){
			res.send(data);
		})
	}
})

app.get('/query/targetlocations', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TARGET_LOCATION";';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/coreshelter100', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "core_shelter_100_percent_completion" WHERE hh_id_qr != ' + "''" + ';';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/sra', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "SHELTER_SRA" LEFT OUTER JOIN "HOUSEHOLD" ON ("SHELTER_SRA".c_u_household_id = "HOUSEHOLD".household_id);';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/stedparticipants', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "LIVELIHOOD_STED_PARTICIPANT";';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/livelihoodccg', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT "LIVELIHOOD_CCG".household_id, amount_category, livelihood_category, livelihood_proposal, head_of_hh_fname, head_of_hh_lname ' +
					'FROM "LIVELIHOOD_CCG" LEFT OUTER JOIN "HOUSEHOLD" ON ("LIVELIHOOD_CCG".household_id = "HOUSEHOLD".household_id);';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.post('/query/enumerationhousephoto', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT house_photo FROM "ENUMERATION" WHERE household_id=' + "'" + req.body.id  + "';";
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/safersheltertraining', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TRAINING_PARTICIPANT" WHERE "training_name"=' + "'" + 'Safer Shelter Techniques Orientation' + "'" + ';';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/agriculturetraining', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TRAINING_PARTICIPANT" WHERE "sector"=' + "'" + 'Livelihood' + "'" + ';';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/phast', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TRAINING_MODULE_PARTICIPATION";';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/hhlocations', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT "HOUSEHOLD".household_id AS id, "HOUSEHOLD".gps_long AS lng, "HOUSEHOLD".gps_lat AS lat,' +
			' core_shelter_100_percent_completion.hh_type AS core, "SHELTER_SRA".c_u_category AS sra FROM "HOUSEHOLD"' +
			' LEFT JOIN core_shelter_100_percent_completion ON CAST("HOUSEHOLD".household_id AS TEXT) = core_shelter_100_percent_completion.hh_id' +
			' LEFT JOIN "SHELTER_SRA" ON "HOUSEHOLD".household_id = "SHELTER_SRA".c_u_household_id;';
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.post('/query/hhoverview', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "HOUSEHOLD_DEMOGRAPHICS" FULL JOIN "HOUSEHOLD"' +
			' ON "HOUSEHOLD".household_id = "HOUSEHOLD_DEMOGRAPHICS".household_id' +
			' WHERE "HOUSEHOLD_DEMOGRAPHICS".household_id=' + "'" + req.body.id  + "';";
			pghelper.query(queryStr, function(err, data){
				res.send(data);
			})
	}
})
app.get('/query/water1', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT *, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM community_works_tool_v2 WHERE sector_intervention=' + "'hand pump' AND ws_shed='y';";
			pghelper.query(queryStr, function(err, data){
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

app.get('/sra',function(req,res) {
	if (req.user) {
    res.render('sra', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/safer-shelter-training',function(req,res) {
	if (req.user) {
    res.render('safer-shelter-training', {
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

app.get('/agriculture',function(req,res) {
	if (req.user) {
    res.render('agriculture', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/phast',function(req,res) {
	if (req.user) {
    res.render('phast', {
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

app.get('/households-overview',function(req,res) {
	if (req.user) {
    res.render('households-overview', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/community-infrastructure',function(req,res) {
	if (req.user) {
    res.render('community-infrastructure', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/analytics',function(req,res) {
	if (req.user) {
    res.render('analytics', {
			user:req.user,
			location:localConfig.application.nginxlocation,
      opts:localConfig.page,
			error:req.flash("loginMessage")
    });
	} else {
		res.redirect(localConfig.application.nginxlocation);
	}
})

app.get('/assets',function(req,res) {
	if (req.user) {
    res.render('assets', {
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
