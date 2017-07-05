var settings = require('./settings.js');
var fs = require('fs');
var flow = require('flow');
var path = require('path');
global.appRoot = path.resolve(__dirname);
var crypto = require('crypto');
var sqlite3 = require('sqlite3');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcrypt');
const saltRounds = 10;

// initialize database
var file = path.resolve(__dirname,'db',settings.app.db);
fs.existsSync(file);
var db = new sqlite3.Database(file);

// initialize db table for admin users
db.run("CREATE TABLE IF NOT EXISTS users ( id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, password TEXT, permissions TEXT )", function(err) {
    if(err) { throw Error(err); }
    db.get("SELECT user from users", function(err, row) {
      if(err) { throw Error(err); }
      if(!row) {
        bcrypt.hash(settings.app.defaultpass, saltRounds, function(err, hash) {
          db.run("INSERT INTO users ( user, password, permissions ) VALUES( ?, ?, 'admin' )", settings.app.defaultuser, hash, function(err) {
            if(err) { throw Error(err); }
          });
        });
      }
    });
});

// initialize db table for gallery
db.run('CREATE TABLE IF NOT EXISTS gallery ( ' +
  'rowid INTEGER PRIMARY KEY AUTOINCREMENT, ' +
  'published INTEGER DEFAULT 0, ' +
  'caption TEXT, ' +
  'filename TEXT' + ' )', function(err) { if(err) { throw Error(err); } });

db.run('CREATE TABLE IF NOT EXISTS documents ( ' +
  'rowid INTEGER PRIMARY KEY AUTOINCREMENT, ' +
  'key TEXT, ' +
  'published INTEGER DEFAULT 0, ' +
  'title TEXT, ' +
  'description TEXT, ' +
  'category TEXT, ' +
  'subcategory TEXT, ' +
  'type TEXT, ' +
  'date TEXT, ' +
  'creator TEXT, ' +
  'bytes INTEGER' + ' )' , function(err) { if(err) { throw Error(err); } });

// db functions
var createUser = function(req, res) {
  var user = req.body.user;
  var permissions = req.body.permissions;
  db.get('SELECT user FROM users WHERE user = ?', user, function(err, row) {
    // if(err)
    if(row) {
      req.flash('errorMessage', " there is already a user with that name");
      res.redirect(settings.page.nginxlocation + 'admin/users');
    } else {
      bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        db.run('INSERT INTO users ( user, password, permissions ) VALUES( ?, ?, ? )', user, hash, permissions, function(err) {
          // if(err)
          if(this.lastID) {
            req.flash('successMessage', " user created");
            res.redirect(settings.page.nginxlocation + 'admin/users');
          } else {
            req.flash('errorMessage', " something went wrong");
            res.redirect(settings.page.nginxlocation + 'admin/users');
          }
        });
      });
    }
  });
}

var deleteUser = function(req, res) {
  if(req.user.id == req.body.id) {
    req.flash('errorMessage', " you can't delete yourself");
    res.redirect(settings.page.nginxlocation + 'admin/users');
  } else {
    db.run('DELETE FROM users WHERE id = ?', req.body.id, function(err) {
      if(err) {
        //...
      } else {
        req.flash('successMessage', " user deleted");
        res.redirect(settings.page.nginxlocation + 'admin/users');
      }
    });
  }
}


// # hashing the password takes a second
// # need to let it complete before moving on
// # when updating a user
var updatePassword = function(req, res, cb) {
  if(req.body.password.length == 0) {
    req.flash('successMessage', " password not changed");
    cb(req, res);
  } else {
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
      if(err) console.log(err)
      req.flash('successMessage', " password updated");
      req.query += "password = '" + hash + "', " ;
      req.runquery = true;
      cb(req, res);
    });
  }
}

var updatePermissions = function(req, res, cb) {
  if(req.user.id == req.body.id && req.body.permissions != "admin") {
    req.flash('errorMessage', " you can't remove your own admin status");
    cb(req, res);
  } else {
    req.query += "permissions = '" + req.body.permissions + "'";
    req.runquery = true;
    cb(req, res);
  }
}

var editUser = flow.define(
  function(req, res) {
    req.runquery = false;
    req.query = "UPDATE users SET ";
    updatePassword(req, res, this);
  }
  ,function(req, res) {
    updatePermissions(req, res, this);
  }
  ,function(req, res) {
    if(req.runquery == true) {
      req.query += " WHERE id = " + req.body.id;
      db.run(req.query, function(err) {
        if(err) {
          //...
          console.log(err);
          req.flash('errorMessage', " something went wrong");
          res.redirect(settings.page.nginxlocation + 'admin/users');
        } else {
          req.flash('successMessage', " user updated");
          res.redirect(settings.page.nginxlocation + 'admin/users');
        }
      });
    } else {
      req.flash('errorMessage', " something went wrong");
      res.redirect(settings.page.nginxlocation + 'admin/users');
    }
  }
);

var listUsers = function(cb) {
  db.all('SELECT id, user, permissions FROM users', function(err, rows) {
    // if(err)
    cb(rows);
  });
}

// setting up user authentication
passport.use(new LocalStrategy({ usernameField: 'user' }, function(user, password, done) {
  db.get('SELECT password FROM users WHERE user = ?', user, function(err, row) {
    if (!row) return done(null, false);
    bcrypt.compare(password, row.password, function(err, res) {
      if(!res) return done(null, false);
      db.get('SELECT user, id FROM users WHERE user = ?', user, function(err, row) {
        return done(null, row);
      });
    });
  });
}));

passport.serializeUser(function(user, done) {
  return done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  db.get('SELECT id, user, permissions FROM users WHERE id = ?', id, function(err, row) {
    if (!row) { return done(null, false); }
    return done(null, row);
  });
});

// setting up the app
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var SQLiteStore = require('connect-sqlite3')(session);
var flash = require('express-flash');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');

var app = express();
// bodyParser to let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cookieParser('secret'));
app.use(session({
  store: new SQLiteStore({dir:path.resolve(__dirname,'db')}),
  secret: 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

app.engine('handlebars', exphbs({
  defaultLayout: 'main',
  helpers: {
    eq: function(v1,v2,options) {
			if (v1 && v2 && v1.toString() === v2.toString()) {
				return options.fn(this);
			}
			return options.inverse(this);
		},
    returnThumb: function(filePath) {
      return filePath.slice(0, filePath.lastIndexOf(".")) +
        "_THUMB" + filePath.slice(filePath.lastIndexOf("."));
    },
    formatDate: function(context,format) {
			return moment(context).format(format);
		}
  }
}));
app.set('view engine', 'handlebars');

app.use(express.static('public'));

app.post('/login', passport.authenticate('local', {
    failureRedirect: settings.page.nginxlocation
  }), function(req, res) {
    res.redirect(settings.page.nginxlocation);
  }
);

app.post('/logout', function(req, res) {
	req.session.destroy(function(err) {
		res.redirect(settings.page.nginxlocation);
	})
});

app.get('/', function(req, res) {
		res.render('home',{
			user:req.user,
      opts:settings.page
		});
});

app.get('/admin/site', function(req, res) {
	if (req.user && req.user.permissions == "admin") {
		res.render('admin-site',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/admin/users', function(req, res) {
  if(req.user && req.user.permissions == "admin") {
    listUsers(function(result) {
      res.render('admin-users',{
        user:req.user,
        users: result,
        opts:settings.page,
        error:req.flash("errorMessage"),
        success:req.flash("successMessage")
      });
    });
  } else {
    res.redirect(settings.page.nginxlocation);
  }
});

app.post('/admin/user', function(req, res) {
  if (req.user && req.user.permissions == "admin") {
    switch(req.body["_method"]) {
      case "DELETE":
        deleteUser(req, res);
      break;
      case "PUT":
        editUser(req, res);
      break;
      default:
        createUser(req, res);
      break;
    }
  } else { res.redirect(settings.page.nginxlocation); }
});

var PostGresRefresh = require("./routes/postGresRefresh.js");
var postGresRefresh = new PostGresRefresh();

app.post('/admin/dbrefresh', function (req, res){
	if (req.user && req.user.permissions == "admin"){
		postGresRefresh.run(function(err,data){
			res.send(data);
		});
	}
})

// gallery stuff
var multer  = require('multer');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var gm = require('gm');
var moment = require('moment');

app.get('/api/gallery/:rowid', function(req, res) {
  if(req.user) {
    var query = "SELECT * FROM gallery WHERE rowid = " + req.params.rowid;
    db.get(query, function(err, row) {
      if(err) { console.log(err); }
      res.json(row);
    });
  }
});

app.get('/edit/gallery', function(req, res) {
  if (req.user && (req.user.permissions == "admin" || req.user.permissions == "editor")) {
    db.all('SELECT * FROM gallery', function(err, result) {
      res.render('admin-gallery',{
        user:req.user,
        images: result,
        opts:settings.page,
        error:req.flash("errorMessage"),
        success:req.flash("successMessage")
      });
    });
  } else {
    res.redirect(settings.page.nginxlocation);
  }
})

var galleryImage = multer({ dest: path.join(appRoot, 'tmp') })

var deleteImage = function(req, res) { }
var editImage = function(req, res) {
  var query = "UPDATE gallery SET ";
  var updates = [];
  for (key in req.body) {
    if(key !== "_method") {
      updates.push(key + " = '" + req.body[key].replace("'","''") + "'" ) // single quotes in a string screw up the sql query
    }
  }
  query += updates.join(", ");
  query += " WHERE rowid = " + req.body.rowid;
  db.run(query, function(err) {
    // if(err)
    if(this.changes) {
      req.flash('successMessage', 'Image updated!');
      res.redirect(settings.page.nginxlocation + 'edit/gallery');
    } else {
      req.flash('errorMessage', 'Apologies, it seems something went wrong.');
      res.redirect(settings.page.nginxlocation + 'edit/gallery');
    }
  });

}

var uploadImage = function(req, res){
  var timestamp = moment().format("YYYY-MM-DD_HH-mm-ss");
  var tmpImg = req.file.path;

  var processImage = flow.define(
    function() {
      // upload the original image
      req.file.originalname = req.file.originalname.replace(/\s/g, "_");
      var body = fs.createReadStream(tmpImg);
      var key = settings.s3.galleryfolder + "/" + timestamp + "_" +
        req.file.originalname.slice(0, req.file.originalname.lastIndexOf(".")) +
        "_ORIGINAL" + req.file.originalname.slice(req.file.originalname.lastIndexOf("."));
      s3.upload({ Body: body, Bucket: settings.s3.mediabucket, Key: key }, this);
    }
    ,function(err, data) {
      // shrink some if it's big
      gm(tmpImg)
        .resize('1000', '800', '>')
        // Use > to change the dimensions of the image only if its width or height exceeds the geometry specification.
        .write(tmpImg, this)
    }
    ,function() {
      // upload the resized image for use on the website
      var body = fs.createReadStream(tmpImg);
      var key = settings.s3.galleryfolder + "/" + timestamp + "_" + req.file.originalname;
      s3.upload({ Body: body, Bucket: settings.s3.mediabucket, Key: key }, this);
    }
    ,function(err, data) {
      // save the filename for our db insert query later
      this.key = data.key;
      // resize to a thumbnail
      gm(tmpImg)
        .resize('200', '200', '^')
        // Append a ^ to the geometry so that the image is resized while maintaining the aspect ratio of the image,
        // but the resulting width or height are treated as minimum values rather than maximum values.
        .gravity('Center')
        .crop('200', '200')
        .write(tmpImg, this)
    }
    ,function() {
      // upload the thumbnail
      var body = fs.createReadStream(tmpImg);
      var key = settings.s3.galleryfolder + "/" + timestamp + "_" +
        req.file.originalname.slice(0, req.file.originalname.lastIndexOf(".")) +
        "_THUMB" + req.file.originalname.slice(req.file.originalname.lastIndexOf("."));
      s3.upload({ Body: body, Bucket: settings.s3.mediabucket, Key: key }, this);
    }
    ,function() {
      // unlink (delete) the file from tmp
      fs.unlink(tmpImg, this);
    }
    ,function() {
      // save the metadata to our db table
      var query = "INSERT INTO gallery (published, caption, filename) VALUES (" +
        "'" + req.body.published + "', " +
        "'" + req.body.caption + "', " +
        "'" + this.key + "') ";
        console.log(query);
      db.run(query, function(err) {
        res.redirect(settings.page.nginxlocation + 'edit/gallery');
      });
    }
  );
  processImage();
}

app.post('/edit/gallery', galleryImage.single('imageFile'), function(req, res) {
  if (req.user && (req.user.permissions == "admin" || req.user.permissions == "editor")) {
    switch(req.body["_method"]) {
      case "DELETE":
        deleteImage(req, res);
      break;
      case "PUT":
        editImage(req, res);
      break;
      default:
        uploadImage(req, res);
      break;
    }
  } else { res.redirect(settings.page.nginxlocation + 'edit/gallery'); }
});


// documents stuff
app.get('/edit/documents', function(req, res) {
  if (req.user && (req.user.permissions == "admin" || req.user.permissions == "editor")) {
    db.all('SELECT * FROM documents', function(err, result) {
      res.render('admin-documents',{
        user:req.user,
        documents:result,
        settings:settings.documents,
        opts:settings.page,
        error:req.flash("errorMessage"),
        success:req.flash("successMessage")
      });
    });
  } else {
    res.redirect(settings.page.nginxlocation);
  }
})

var multerS3 = require('multer-s3');

var documentsDoc = multer({
  storage: multerS3({
    s3: s3,
    bucket: settings.s3.mediabucket,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function(req, file, cb) {
      // append upload timestamp to filename
      var key = settings.s3.docsfolder + '/' + file.originalname.substr(0, file.originalname.lastIndexOf('.')) +
        '_' + moment().format("YYYYMMDD-HHmmss") + path.extname(file.originalname);
      cb(null, key);
    }
  })
});

var deleteDoc = function(req, res) { }
var editDoc = function(req, res) {
  if(req.body.subcategory === undefined) {
    req.body.subcategory = "";
  }
  var query = "UPDATE documents SET ";
  var updates = [];
  for (key in req.body) {
    if(key !== "_method" && key !== "rowid") {
      updates.push(key + " = '" + req.body[key].replace("'","''") + "'" ) // single quotes in a string screw up the sql query
    }
  }
  query += updates.join(", ");
  query += " WHERE rowid = " + req.body.rowid;
  console.log(query);
  db.run(query, function(err) {
    // if(err) ...
    if(this.changes) {
      req.flash('successMessage', 'Document metadata updated!');
      res.redirect(settings.page.nginxlocation + 'edit/documents');
    } else {
      req.flash('errorMessage', 'Apologies, it seems something went wrong.');
      res.redirect(settings.page.nginxlocation + 'edit/documents');
    }
  });
}

var createDoc = function(req, res) {
  if(req.body.subcategory === undefined) {
    req.body.subcategory = "";
  }
  var query = "INSERT into documents (key, published, title, description, category, subcategory, type, date, creator, bytes) VALUES (" +
    "'" + req.file.key + "', " +
    "'" + req.body.published + "', " +
    "'" + req.body.title.replace("'","''") + "', " +
    "'" + req.body.description.replace("'","''") + "', " +
    "'" + req.body.category.replace("'","''") + "', " +
    "'" + req.body.subcategory.replace("'","''") + "', " +
    "'" + req.body.type.replace("'","''") + "', " +
    "'" + req.body.date.replace("'","''") + "', " +
    "'" + req.user.user.replace("'","''") + "', " +
    "'" + req.file.size + "') ";
    // TODO: make a function to getting string values ready for inclusion in sql queries and figure that out
    console.log(query);
  db.run(query, function(err) {
    // if(err)
    if(this.changes) {
      req.flash('successMessage', 'File uploaded');
      res.redirect(settings.page.nginxlocation + 'edit/documents');
    } else {
      req.flash('errorMessage', 'Apologies, it seems something went wrong.');
      res.redirect(settings.page.nginxlocation + 'edit/documents');
    }
  });
}

app.post('/api/documents', documentsDoc.single('docFile'), function(req, res) {
  if (req.user && req.user.permissions == "admin") {
    switch(req.body["_method"]) {
      case "DELETE":
        deleteDoc(req, res);
      break;
      case "PUT":
        editDoc(req, res);
      break;
      default:
        createDoc(req, res);
      break;
    }
  } else { res.redirect(settings.page.nginxlocation + 'edit/documents'); }
});

// TODO: require a user here
app.get('/api/documents/all', function(req, res){
  var query = "SELECT * FROM documents";
  db.all(query, function(err, rows) {
      // if(err) ...
      res.json(rows);
  });
});

app.get('/api/documents/published', function(req, res){
  var query = "SELECT * FROM documents WHERE published = 1";
  db.all(query, function(err, rows) {
      // if(err) ...
      res.json(rows);
  });
});

app.get('/api/documents/doc/:rowid', function(req, res) {
  if(req.user) {
    var query = "SELECT * FROM documents WHERE rowid = " + req.params.rowid;
    db.get(query, function(err, row) {
      // if(err) ...
      res.json(row);
    });
  }
});

app.get('/gallery', function(req, res) {
  if (req.user) {
    res.render('gallery',{
      user:req.user,
      opts:settings.page
    });
  } else {
    res.redirect(settings.page.nginxlocation);
  }
});

app.get('/api/pages/gallery', function(req, res) {
  if (req.user) {
    db.all('SELECT * FROM gallery', function(err, result) {
      // if(err) ...
      res.json(result);
    });
  }
});

// for dashboard pages using a postgres connection
var PostGresHelper = require("./routes/postGresHelper.js");
var pghelper = new PostGresHelper();

app.get('/progress', function(req, res) {
	if (req.user) {
		res.render('progress',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
});

app.get('/api/pages/progress', function(req, res) {
	if (req.user) {
		var queryStr = 'SELECT * FROM "INDICATOR_TRACKING_TABLE" where remarks='+"'visible';";
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});

app.get('/hardware', function(req, res) {
	if (req.user) {
		res.render('hardware',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
});

app.get('/api/pages/hardware', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "HARDWARE_INDICATORS";';
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});

app.get('/software', function(req, res) {
	if (req.user) {
		res.render('software',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
});

app.get('/api/pages/software', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "SOFTWARE_INDICATORS";';
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});

app.get('/agriculture',function(req,res) {
	if (req.user) {
    res.render('agriculture', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/agriculture', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TRAINING_PARTICIPANT" WHERE "sector"=' + "'" + 'Livelihood' + "'" + ';';
			pghelper.query(queryStr, function(err, data) {
				res.json(data);
			})
	}
})

app.get('/ccg',function(req, res) {
	if (req.user) {
    res.render('ccg', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/ccg', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT "LIVELIHOOD_CCG".household_id, amount_category, livelihood_category, livelihood_proposal, head_of_hh_fname, head_of_hh_lname ' +
        'FROM "LIVELIHOOD_CCG" LEFT OUTER JOIN "HOUSEHOLD" ON ("LIVELIHOOD_CCG".household_id = "HOUSEHOLD".household_id);';
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/sted',function(req, res) {
	if (req.user) {
    res.render('sted', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/sted', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "LIVELIHOOD_STED_PARTICIPANT";';
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/sra',function(req, res) {
	if (req.user) {
    res.render('sra', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/sra', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "SHELTER_SRA" LEFT OUTER JOIN "HOUSEHOLD" ON ("SHELTER_SRA".c_u_household_id = "HOUSEHOLD".household_id);';
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/safer-shelter-training',function(req, res) {
	if (req.user) {
    res.render('safer-shelter-training', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/safer-shelter-training', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "TRAINING_PARTICIPANT" WHERE "training_name"=' + "'" + 'Safer Shelter Techniques Orientation' + "'" + ';';
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/core-shelter',function(req, res) {
	if (req.user) {
    res.render('core-shelter', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/core-shelter', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "core_shelter_100_percent_completion" WHERE hh_id_qr != ' + "''" + ';';
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/api/pages/core-shelter/enumerationhousephoto/:id', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT house_photo FROM "ENUMERATION" WHERE household_id=' + "'" + req.params.id  + "';";
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/phast',function(req, res) {
	if (req.user) {
    res.render('phast', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/phast', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "TRAINING_MODULE_PARTICIPATION";';
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/rc143',function(req, res) {
	if (req.user) {
    res.render('drr-143', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/rc143', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "TRAINING_PARTICIPANT" WHERE "sector"=' + "'DRR' AND participant_type='143 Volunteer'";
    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
})

app.get('/households-overview',function(req,res) {
	if (req.user) {
    res.render('households-overview', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/households-overview/hhlocations', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT "HOUSEHOLD".household_id AS id, "HOUSEHOLD".gps_long AS lng, "HOUSEHOLD".gps_lat AS lat,'+
              'core_shelter_100_percent_completion.hh_type AS core, "SHELTER_SRA".c_u_category AS sra,'+
              '"LIVELIHOOD_STED_PARTICIPANT".training_applied_for AS sted FROM "HOUSEHOLD"'+
              ' LEFT JOIN core_shelter_100_percent_completion ON CAST("HOUSEHOLD".household_id AS TEXT) = core_shelter_100_percent_completion.hh_id_qr'+
              ' LEFT JOIN "SHELTER_SRA" ON "HOUSEHOLD".household_id = "SHELTER_SRA".c_u_household_id'+
              ' LEFT JOIN "LIVELIHOOD_CCG" ON "HOUSEHOLD".household_id = "LIVELIHOOD_CCG".household_id'+
              ' LEFT JOIN "LIVELIHOOD_STED_PARTICIPANT" ON "HOUSEHOLD".household_id = "LIVELIHOOD_STED_PARTICIPANT".household_id;';
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});
app.get('/api/pages/households-overview/hhoverview/:id', function(req, res) {
	if (req.user) {
    var queryStr = 'SELECT * FROM "HOUSEHOLD_DEMOGRAPHICS" FULL JOIN "HOUSEHOLD"' +
    ' ON "HOUSEHOLD".household_id = "HOUSEHOLD_DEMOGRAPHICS".household_id' +
    ' WHERE "HOUSEHOLD_DEMOGRAPHICS".household_id=' + "'" + req.params.id  + "';";
		pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});

app.get('/community-infrastructure',function(req,res) {
	if (req.user) {
    res.render('community-infrastructure', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/api/pages/commmunity-infrastructure', function(req, res) {
	if (req.user) {

    var queryStr = 'SELECT *, ST_X(geom) AS lng, ST_Y(geom) AS lat FROM community_works_tool_v3 WHERE sector_intervention='+"'water system'"+ ' OR sector_intervention='+"'hand pump'"+' OR sector_intervention='+"'streetlight';";

    pghelper.query(queryStr, function(err, data) {
			res.json(data);
		})
	}
});

app.get('/spot-maps',function(req,res) {
	if (req.user) {
    res.render('spot-maps', {
      user:req.user,
			opts:settings.page
    });
	} else {
		res.redirect(settings.page.nginxlocation);
	}
})

app.get('/documents', function(req, res) {
	if (req.user) {
		res.render('documents',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
});

app.get('/analytics', function(req, res) {
	if (req.user) {
		res.render('analytics',{
			user:req.user,
			opts:settings.page
		});
	} else {
		res.redirect(settings.page.nginxlocation);
	}
});

app.get('/api/pages/targetlocations', function(req,res) {
	if (req.user) {
			var queryStr = 'SELECT * FROM "TARGET_LOCATION";';
			pghelper.query(queryStr, function(err, data) {
				res.json(data);
			})
	}
});

app.listen(settings.app.port, function() {
  console.log('app listening on port ' + settings.app.port);
});
