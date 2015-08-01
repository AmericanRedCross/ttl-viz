//Config stuff
var http = require('http');
var url = require('url');
var moment = require('moment');
var fs = require('fs');
var localConfig = require('../config');
var bcrypt = require('bcrypt-nodejs');
var PDFImage = require("pdf-image").PDFImage;
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var sharp = require('sharp');
var csv = require('csv');

var noFunc = function(){};

function Session(req,res) {
	this.req = req;
	this.res = res;
}

Session.prototype.fail = function(data) {
	console.error("Assets App: Error ("+this.req.connection.remoteAddress+")");
	console.error(data.message);
	data.status = "failure";
	this.res.type("json").status(data.code).write(JSON.stringify(data));
	this.res.end();
}

Session.prototype.success = function(data) {
	console.log("Assets App: Success ("+this.req.connection.remoteAddress+")");
	data.status = "success";
	this.res.type("json").write(JSON.stringify(data));
	this.res.end();
}

Session.prototype.handle = function(err,data,proceed) {
	if (!err) {
		if (proceed) {
			proceed(data);
		}
	} else {
		this.fail({message:err,code:500});
	}
}

//Supporting classes

var assetSchema = new Schema({
  title: {type: String, required:true},
  date: { type: Date, default: Date.now },
  createDate: { type: Date, default: Date.now },
  description: {type: String, required:true},
  file: Schema.Types.ObjectId,
  filename: String,
  file_mime: String,
  thumbnail: Schema.Types.ObjectId,
  thumbnail_mime: String,
  size:	Number,
  longitude: Number,
  latitude: Number,
  link: String,
  user: {type: String, required:true},
  public: {type: Boolean, required:true, default: false},
  type: {type: String, required:true}
},{
	collection:'assets'
})

var tagPath = {};

for (key in localConfig.asset_opts.tags) {
	var tag = localConfig.asset_opts.tags[key];
	tagPath[key] = {type:Array,required:tag.required};
}

assetSchema.add({tags:tagPath});

var Asset = mongoose.model('Asset',assetSchema);

var userSchema = new Schema({
  email: {type:String,required:true,unique:true},
  password: {type:String,required:true},
  permissions: {type:String,required:true}
},{
	collection:'users'
})

userSchema.index({email:1},{unique:true});

userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

var User = mongoose.model('User',userSchema);

//Application controller
var mongo = require('mongodb');
var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

function Ctrl(host, port) {
	var that = this;
	this.db = new Db(localConfig.db, new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
	this.db.open(function(err, db) {
		if (err) {
			console.error("Assets App: Error: "+err);
		}
		mongoose.connection.on('open', function () {
			db.collection("users",{strict:true},function(err,collection) {
				if (!collection) {
					var defaultUser = new User();
					defaultUser.email = "defaultUser@redcross.org";
					defaultUser.permissions = "super";
					defaultUser.password = defaultUser.generateHash("pa$$w0rd");	
					defaultUser.save(function(err) {
		                if (err) {
		                	console.error("Could not create default super user");
		                }
		            })
				}
			});
		})
		
		mongoose.connect('mongodb://localhost/'+localConfig.db);
	    var Grid = require('gridfs-stream');
	    Grid.mongo = mongoose.mongo;
	 
	    that.gfs = Grid(db);
	})
}

Ctrl.prototype.MOID = function(id) {
	return mongo.ObjectID(id);
}

Ctrl.prototype.createAsset = function(req,res) {
	var ctrl = this;
	Asset.findOne({ 'title' :  req.body.title }, function(err, asset) {
		if (err) { req.flash('createMessage', 'Unable to create a new asset at this time.'); };
		if (asset) {
		    req.flash('createMessage', 'There is already an asset with that name.');
		    res.redirect("/assets");
		} else {
			var newAsset = new Asset();
			for (key in req.body) {
				newAsset[key] = req.body[key];
			}	
			newAsset.user = req.user.email;
			
		    ctrl.handleAssetFiles(req,res,newAsset,'createMessage','Unable to create a new asset at this time.',function() {
		    	newAsset.save(function(err) {
		    		console.log("Created Asset",newAsset);
			        if (err) {
			        	req.flash(flashType,flashMsg);
			        }
			        res.redirect("/assets");
			    })
		    });
       	}
   	})
}

Ctrl.prototype.updateAsset = function(req,res,opts) {
	var ctrl = this;
	Asset.findOne(opts, function(err, asset) {
		if (err) { req.flash('editMessage', 'Unable to edit that asset at this time.'); };
		if (asset) {
			for (key in req.body) {
				if (key == "tags") {
					for (tagSet in req.body[key]) {
						if (typeof req.body[key][tagSet] != "object") {
							req.body[key][tagSet] = [req.body[key][tagSet]];
						}
					}
				}
				asset[key] = req.body[key];
			}
			if (!req.body.public) {
				asset.public = false;
			}
		    ctrl.handleAssetFiles(req,res,asset,'editMessage','Unable to edit that asset at this time.',function() {
		    	asset.save(function(err) {
		    		console.log("Updated Asset",asset);
			        if (err) {
			        	req.flash('editMessage','Unable to edit that asset at this time.');
			        }
			        res.redirect("/assets");
			    })
		    });
		} else {
			req.flash('editMessage', 'There is no asset with that ID or you do not have permission to edit it.');
		    res.redirect("/assets");
       	}
   	})
}

Ctrl.prototype.deleteAsset = function(req,res,opts) {
	Asset.findOne(opts, function(err, asset) {
		if (err) { req.flash('deleteMessage', 'Unable to delete that asset at this time.'); };
		if (asset) {
			asset.remove(function(err) {
                if (err) {
                	req.flash('deleteMessage', 'Unable to delete that asset at this time.');
                }
                res.redirect("/assets");
            })
		} else {
			req.flash('deleteMessage', 'There is no asset with that ID or you do not have permission to delete it.');
		    res.redirect("/assets");
       	}
   	})
}

Ctrl.prototype.handleAssetFiles = function(req,res,asset,flashType,flashMsg,complete) {
	var ctrl = this;
	function step(file) {
		ctrl.handleFile(asset,file,function() {
			!requests.active && (complete());
		})
	}
	function removeFile(file,callback) {
		requests.active++;
		ctrl.gfs.remove({_id:asset[file]},function(err) {
			delete asset[file];
			requests.active--;
			callback();
		})
	}
	var requests = {active:0};
	if (req.files && req.files.file) {
		var file = req.files.file;
		asset.thumbnail && (removeFile("thumbnail",function() {
			!requests.active && (step(file));
		}));
		
		if (asset.file) {
			removeFile("file",function() {
				!requests.active && (step(file));
			});
		} else {
			!requests.active && (step(file));
		}
	} else {
		complete();
	}
}

Ctrl.prototype.handleFile = function(asset,file,callback) {
	var ctrl = this;
	var filename = file.originalname;
	var read_stream = fs.createReadStream(file.path);
	asset.file_mime = file.mimetype;
	asset.size = file.size;
	asset.filename = asset.type.replace(/[^a-zA-Z\d\.]/g,"-").toLowerCase()+"-"+(new Date().getTime())+"-"+file.originalname.replace(/[^a-zA-Z\d\.]/g,"-").toLowerCase();
	var ws = ctrl.gfs.createWriteStream({
        filename: asset.filename
    });
    ws.on("close",function(writeFile) {
    	asset.file = writeFile._id;
    	if (file.extension == "pdf") {
			var pdfImage = new PDFImage(file.path);
			pdfImage.convertPage(0).then(function (imagePath) {
				var filename = imagePath.replace("/tmp/","");
				asset.thumbnail_mime = "image/png";
				var rs = fs.createReadStream(imagePath);
				var ws = ctrl.gfs.createWriteStream({
					filename:filename
				});
				ws.on("close",function(writeFile) {
					asset.thumbnail = writeFile._id;
					callback();
				})
				rs.pipe(ws);
			},function(err) {
				console.error(err);
				callback();
			})
		} else {
			callback();
		}
    })
	read_stream.pipe(ws);
}

Ctrl.prototype.getAssets = function(user,query,callback) {
	var ctrl = this;
	var queryLen = 0;
	for (queryTerm in query) {
		var valid = false;
		for (term in assetSchema.paths) {
			var assetItem = assetSchema.paths[term];
			if (term == queryTerm) {
				valid = true;
				if (assetItem.instance == "Array") {
					var queryVal = query[queryTerm];
					query[queryTerm] = {$in:((typeof queryVal == "object") ? queryVal : [queryVal])}
				}
				if (queryTerm == "_id") {
					query[queryTerm] = ctrl.MOID(query[queryTerm]);
				}
				queryLen++;
			}
		}
		if (!valid) {
			delete query[queryTerm];
		}
	}
	ctrl.db.collection("assets", {strict:true}, function(err,collection) {
		if (!err) {
			var opts = queryLen ? query : {};
			if (!user) {
				opts.public = true;
			} else if (user.permissions != "super") {
				opts.$or = [{public:true},{user:user.email}];
			}
			collection.find(opts).toArray(function(err,result) {
				if (!err) {
					callback(result);
				} else {
					callback([]);
				}
			})
		} else {
			callback([]);
		}
	})
}

Ctrl.prototype.getAsset = function(user,id,callback) {
	var query = {_id:id};
	if (!user) {
		query.public = true;
	} else if (user.permissions != "super") {
		query.user = user.email;
	}
	Asset.findOne(query, function(err, asset) {
		if (!err && asset) { 
			callback(asset);
		} else {
			callback(undefined);
		}
   	})
}

Ctrl.prototype.getAssetFile = function(user,id,callback,req,res) {
	var ctrl = this;
	var query = {_id:id};
	if (!user) {
		query.public = true;
	} else if (user.permissions != "super") {
		query.user = user.email;
	}
	Asset.findOne(query, function(err, asset) {
		if (!err && asset) { 
			ctrl.gfs.files.findOne({_id:asset.file},function(err,file) {
				if (!err && file) {
					res.set('Content-Type', asset.file_mime);
					res.set('Content-Disposition', 'attachment; filename="'+file.filename+'"');
		            var read_stream = ctrl.gfs.createReadStream(file);
		            read_stream.pipe(res);
				} else {
					callback();
				}
			})
		} else {
			callback();
		}
   	})
}

Ctrl.prototype.getAssetThumb = function(user,id,callback,req,res) {
	var ctrl = this;
	var query = {_id:id};
	if (!user) {
		query.public = true;
	} else if (user.permissions != "super") {
		query.user = user.email;
	}
	var size = req.params.size;
	size = !isNaN(parseInt(size)) ? parseInt(size) : 500;
	Asset.findOne(query, function(err, asset) {
		if (!err) {
			ctrl.gfs.files.findOne({_id:asset.thumbnail},function(err,file) {
				if (!err && file) {
					var stream = ctrl.gfs.createReadStream(file);
					var resize = sharp().resize(size);
					res.set('Content-Type', 'image/png');
					stream.pipe(resize).pipe(res);
				} else {
					callback();
				}
			})
		} else {
			callback();
		}
   	})
}

Ctrl.prototype.exportData = function(req,res,type) {
	var ctrl = this;
	var output;
	function complete() {
		res.set('Content-Type', 'text/csv');
		res.set('Content-Disposition', 'attachment; filename="'+type+'-export.csv"');
		res.send(output);
	}
	if (type == "asset") {
		this.getAssets(req.user,{},function(assets) {
			output = ctrl.csvify(assets,assetSchema);
			complete();
		})
	}
	if (type == "user") {
		this.getUsers(function(users) {
			output = ctrl.csvify(users,userSchema);
			complete();
		})
	}
}

Ctrl.prototype.csvify = function(data,schema) {
	var output = "";
	var paths = schema.paths;
	if (schema == userSchema) {
		delete paths.password;
	}
	var keys = Object.keys(paths);
	var displayKeys = [];
	for (var i=0;i<keys.length;i++) {
		displayKeys[i] = '"'+(keys[i].replace(/"/g,'""'))+'"';
	}
	output += displayKeys.join(",")+"\n";
	for (var i=0;i<data.length;i++) {
		var item = data[i];
		var row = [];
		for (var j=0;j<keys.length;j++) {
			var key = keys[j]
			if (key.indexOf(".") != -1) {
				key = key.split(".");
			}
			var val;
			if (typeof key == "object" && key[0] == "tags") {
				val = item[key[0]][key[1]];
			} else {
				val = item[key];
			}
			if (val && typeof val == "object") {
				if (val.length) {
					val = val.join(", ");
				} else {
					val = JSON.stringify(val).replace(/"/g,"");
				}
			}
			if (val && typeof val != "string") {
				val = val.toString();
			}
			val = !val ? '' : val;
			val = '"'+(val.replace(/"/g,'""'))+'"';
			row.push(val);
		}
		row = row.join(",");
		row += "\n";
		output += row;
	}
	return output;
}

Ctrl.prototype.createUser = function(req,res) {
	 User.findOne({ 'email' :  req.body.email }, function(err, user) {
		if (err) { req.flash('createMessage', 'Unable to save a new user account at this time.'); };
		if (user) {
		    req.flash('createMessage', 'There is already an account associated with that email address.');
		    res.redirect("/users");
		} else {
			var newUser = new User();
			newUser.email = req.body.email;
			newUser.permissions = req.body.permissions;
			newUser.password = newUser.generateHash(req.body.password);	
			newUser.save(function(err) {
                if (err) {
                	req.flash('createMessage', 'Unable to save a new user account at this time.');
                }
                res.redirect("/users");
            })
       	}
   	})
}

Ctrl.prototype.updateUser = function(req,res) {
	User.findOne({ 'email' :  req.params.email }, function(err, user) {
		if (err) { req.flash('editMessage', 'Unable to edit that user account at this time.'); };
		if (user) {
			user.permissions = req.body.permissions;
			if (req.body.password && req.body.password.length > 0) {
				user.password = user.generateHash(req.body.password);	
			}
			user.save(function(err) {
                if (err) {
                	req.flash('editMessage', 'Unable to edit that user account at this time.');
                }
                res.redirect("/users");
            })
		} else {
			req.flash('editMessage', 'There is no user account associated with that email address.');
		    res.redirect("/users");
       	}
   	})
}

Ctrl.prototype.deleteUser = function(req,res) {
	User.findOne({ 'email' :  req.params.email }, function(err, user) {
		if (err) { req.flash('deleteMessage', 'Unable to delete that user account at this time.'); };
		if (user) {
			user.remove(function(err) {
                if (err) {
                	req.flash('deleteMessage', 'Unable to delete that user account at this time.');
                }
                res.redirect("/users");
            })
		} else {
			req.flash('deleteMessage', 'There is no user account associated with that email address.');
		    res.redirect("/users");
       	}
   	})
}

Ctrl.prototype.getUsers = function(callback) {
	var ctrl = this;
	ctrl.db.collection("users", {strict:true}, function(err,collection) {
		if (!err) {
			 collection.find().toArray(function(err,result) {
			 	if (!err) {
			 		callback && callback(result);
			 	} else {
			 		callback && callback([]);
			 	}
			 })
		} else {
			callback && callback([]);
		}
	})
}

Ctrl.prototype.getUser = function(email,callback) {
	User.findOne({email:email}, function(err, user) {
		if (!err && user) { 
			callback(user);
		} else {
			callback(undefined);
		}
   	})
}

Ctrl.prototype.importCSV = function(req,res,type) {
	var file = req.files.import;
	if (file.mimetype != "text/csv") {
		res.flash("createMessage","Invalid file type. Please upload a CSV file.");
		res.redirect("/"+type+"s");
	} else {
		var rs = fs.createReadStream(file.path);
		var parser = csv.parse();
		var output = [];
		parser.on("data",function(data) {
			output.push(data);
		})
		parser.on("finish",function() {
			var headers = output.shift();
			var requests = 0;
			var count = 0;
			var errors = [];
			for (var i=0;i<output.length;i++) {
				var row = output[i];
				var newEntity;
				if (type == "asset") { 
					newEntity = new Asset();
				} else if (type == "user") {
					newEntity = new User();
				}
				for (var j=0;j<row.length;j++) {
					var cell = row[j];
					var header = headers[j];
					if (/\[*\]/.test(header)) {
						header = header.split("[");
						for (var i=0;i<header.length;i++) {
							header[i] = header[i].replace(/]/g,"");
						}
					}
					if (type == "asset" && (typeof header == "object" && header[0] == "tags")) {
						cell = cell.split(",");
					}
					if (type == "user" || (header != "file" && header != "thumbnail")) {
						if (typeof header == "object") {
							if (!newEntity[header[0]]) {
								newEntity[header[0]] = {};
							}
							newEntity[header[0]][header[1]] = cell;
						} else {
							newEntity[header] = cell;
						}
					}
				}
				if (type == "asset") {
					newEntity.user = req.user.email;
				}
				requests++;
		    	newEntity.save(function(err) {
		    		requests--;
			        if (err) {
			        	if (err.toString().indexOf("E11000") != -1) {
			        		var val = err.toString().split("{ : ")[1].replace(" }","");
			        		if (type == "asset") {
			        			err = "There is already an asset with the title "+val+".";
			        		}
							if (type == "user") {
			        			err = "There is already an account associated with the email address "+val+".";
			        		}
			        		
			        	}
			        	errors.push(err);
			        } else {
			        	count++;
			        }
			        if (!requests) {
			        	if (errors.length) {
			        		req.flash("createMessage","<br>"+errors.join("<br>"));
			        	}
			        	if (count > 0) {
			        		req.flash("successMessage","Successfully imported "+count+" "+type+"(s).");
			        	}
			        	res.redirect("/"+type+"s");
			        }
			    })
			}
		})
		rs.pipe(parser);
	}
}


exports.Ctrl = Ctrl;
exports.Asset = Asset;
exports.User = User;


