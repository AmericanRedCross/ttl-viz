//Config stuff
var http = require('http');
var url = require('url');
var moment = require('moment');
var fs = require('fs');
var gm = require('gm').subClass({imageMagick: true});
var localConfig = require('../config');
var bcrypt = require('bcrypt-nodejs');
var PDFImage = require("pdf-image").PDFImage;
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/'+localConfig.db);

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
  thumbnail_id: String,
  title: {type: String, required:true},
  date: { type: Date, default: Date.now },
  description: {type: String, required:true},
  filename: String,
  file: String,
  file_mime: String,
  file_ids: Array,
  thumbnail: String,
  thumbnail_mime: String,
  thumbnail_ids: Array,
  map_size:	Number,
  extent: {type: Array, required:true},
  sector: {type: Array, required:true},
  longitude: Number,
  latitude: Number,
  link: String,
  user: {type: String, required:true}
},{
	collection:'assets'
})

var Asset = mongoose.model('Asset',assetSchema);

var userSchema = new Schema({
  email: {type:String,required:true},
  password: {type:String,required:true},
  permissions: {type:String,required:true}
},{
	collection:'users'
})

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
	this.kpis = [];
	this.db = new Db(localConfig.db, new Server(host, port, {safe: false}, {auto_reconnect: true}, {}));
	this.db.open(function(err, db) {
		if (err) {
			console.error("Assets App: Error: "+err);
		}
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
			
		    ctrl.handleAssetFiles(req,res,newAsset,'createMessage','Unable to create a new asset at this time.');
       	}
   	})
}

Ctrl.prototype.updateAsset = function(req,res,opts) {
	var ctrl = this;
	Asset.findOne(opts, function(err, asset) {
		if (err) { req.flash('editMessage', 'Unable to edit that asset at this time.'); };
		if (asset) {
			for (key in req.body) {
				if (key == "sector" || key == "extent") {
					if (typeof req.body[key] != "object") {
						req.body[key] = [req.body[key]];
					}
				}
				asset[key] = req.body[key];
			}
		    ctrl.handleAssetFiles(req,res,asset,'editMessage','Unable to edit that asset at this time.');
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

Ctrl.prototype.handleAssetFiles = function(req,res,asset,flashType,flashMsg) {
	var ctrl = this;
	function complete() {
		asset.save(function(err) {
	        if (err) {
	        	req.flash(flashType,flashMsg);
	        }
	        res.redirect("/assets");
	    })
	}
	var requests = {active:0};
	for (key in req.files) {
		var file = req.files[key];
		if (asset[key+"_ids"] && asset[key+"_ids"].length) {
			for (var i=0;i<asset[key+"_ids"].length;i++) {
				var id = asset[key+"_ids"][i];
				requests.active++;
				ctrl.gfs.remove({"_id":id},function(err) {
					requests.active--;
					if (!requests.active) {
						ctrl.handleFile(asset,key,file,requests,function() {
							requests.active--;
							!requests.active && (complete());
						})
					}
				})
			}	
		} else {
			ctrl.handleFile(asset,key,file,requests,function() {
				requests.active--;
				!requests.active && (complete());
			});			
		}
	}
	!requests.active && complete();
}

Ctrl.prototype.handleFile = function(asset,key,file,requests,callback) {
	var ctrl = this;
	var filename = file.originalname;
	var read_stream = fs.createReadStream(file.path);
	asset[key] = filename;
	asset[key+"_mime"] = file.mimetype;
	asset[key+"_ids"] = [];
	asset.map_size = file.size;
	requests.active++;
	(function(file) {
		var ws = ctrl.gfs.createWriteStream({
	        filename: filename
	    });
	    ws.on("close",function(writeFile) {
	    	asset[key+"_ids"].push(writeFile._id);
	    	if (key == "file" && file.extension == "pdf") {
				var pdfImage = new PDFImage(file.path);
				pdfImage.convertPage(0).then(function (imagePath) {
					var filename = imagePath.replace("/tmp/","");
					asset.thumbnail = filename;
					asset.thumbnail_mime = "image/png";
					if (asset.thumbnail_ids && asset.thumbnail_ids.length) {
						for (var i=0;i<asset.thumbnail_ids.length;i++) {
							var id = asset.thumbnail_ids[i]
							requests.active++;
							ctrl.gfs.remove({"_id":id},function(err,result) {
								requests.active--;
								if (requests.active == 1) {
									ctrl.createThumbnails(asset,requests,imagePath,function() {
										callback();
									})
								}
							})
						}
					} else {
						ctrl.createThumbnails(asset,requests,imagePath,function() {
							callback();
						})
					}
				})
			} else {
				callback();
			}
	    })
		read_stream.pipe(ws);
   })(file);
}

Ctrl.prototype.createThumbnails = function(asset,requests,imagePath,callback) {
	var ctrl = this;
	asset.thumbnail_ids = [];
	requests.active++;
	gm(imagePath).resize(500).stream(function (err,stdout,stderr) {
		var ws = ctrl.gfs.createWriteStream({
			filename:asset.thumbnail
		});
		ws.on("close",function(writeFile) {
			asset.thumbnail_ids.push(writeFile._id);
			requests.active--;
			(requests.active == 1) && (callback());
		})
		stdout.pipe(ws);
	});
	requests.active++;
	gm(imagePath).resize(250).stream(function (err,stdout,stderr) {
		var ws = ctrl.gfs.createWriteStream({
			filename:"md_"+asset.thumbnail
		});
		ws.on("close",function(writeFile) {
			asset.thumbnail_ids.push(writeFile._id);
			requests.active--;
			(requests.active == 1) && (callback());
		})
		stdout.pipe(ws);
	});
	requests.active++;
	gm(imagePath).resize(100).stream(function (err,stdout,stderr) {
		var ws = ctrl.gfs.createWriteStream({
			filename:"sm_"+asset.thumbnail
		});
		ws.on("close",function(writeFile) {
			asset.thumbnail_ids.push(writeFile._id);
			requests.active--;
			(requests.active == 1) && (callback());
		})
		stdout.pipe(ws);
	});
}

Ctrl.prototype.getAssets = function(user,callback) {
	var ctrl = this;
	ctrl.db.collection("assets", {strict:true}, function(err,collection) {
		if (!err) {
			var opts = undefined;
			if (user.permissions != "super") {
				opts = {user:user.email}
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

Ctrl.prototype.getAsset = function(id,callback) {
	Asset.findOne({_id:id}, function(err, asset) {
		if (!err) { 
			callback(asset);
		} else {
			callback(undefined);
		}
   	})
}

Ctrl.prototype.getAssetFile = function(id,callback,req,res) {
	var ctrl = this;
	Asset.findOne({_id:id}, function(err, asset) {
		if (!err) { 
			ctrl.gfs.files.find({filename:asset.file}).toArray(function(err,files) {
				if (!err && files.length > 0) {
					res.set('Content-Type', asset.file_mime);
					res.set('Content-Disposition', 'attachment; filename="'+files[0].filename+'"');
		            var read_stream = ctrl.gfs.createReadStream({filename: asset.file});
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

Ctrl.prototype.getAssetThumb = function(id,size,callback,req,res) {
	var ctrl = this;
	Asset.findOne({_id:id}, function(err, asset) {
		if (!err) { 
			var filename = asset.thumbnail;
			switch (size) {
				case "med":
				case "medium":
				case "md":
				case "m":
					filename = "med_"+filename;
				break;
				case "sm":
				case "small":
				case "s":
					filename = "sm_"+filename;
				break;
				case "":
				case undefined:
				case "large":
				case "lg":
				case "l":
				default:
					filename = filename;
				break;
			}
			ctrl.gfs.files.find({filename:asset.thumbnail}).toArray(function(err,files) {
				if (!err && files.length > 0) {
					res.set('Content-Type', asset.thumbnail_mime);
		            var read_stream = ctrl.gfs.createReadStream({filename: filename});
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
		if (!err) { 
			callback(user);
		} else {
			callback(undefined);
		}
   	})
}


exports.Ctrl = Ctrl;
exports.Asset = Asset;
exports.User = User;


