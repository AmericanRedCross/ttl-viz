var assetCtrl = {
	templates: {
		editAsset:{}
	},
	prepTemplates: function() {
		var that = this;
		$(this).on("templatesReady",function() {
			this.templatesReady = true;
		})
		var requests = 0;
		for (key in this.templates) {
			(function(key) {
				requests++;
				$.get("/js/views/"+key+".handlebars",function(result) {
					that.templates[key].tpl = Handlebars.compile(result);
					requests--;
					if (!requests) {
						$(that).trigger("templatesReady");
					}
				})
			})(key)
		}
		Handlebars.registerHelper('formatDate', function(context,format) {
			return moment(context).utc().format(format);
		})
		Handlebars.registerHelper('eq',function(v1,v2,options) {
			if (v1 && v2 && v1.toString() === v2.toString()) {  
				return options.fn(this);
			}
			return options.inverse(this);
		})
		Handlebars.registerHelper('neq',function(v1,v2,options) {
			if (v1 && v2 && v1.toString() !== v2.toString()) {  
				return options.fn(this);
			}
			return options.inverse(this);
		})
	},
	view: {
		editAsset: {
			form: undefined,
			type: undefined,
			file: undefined,
			url: undefined
		}
	},
	model: {
		editAsset: undefined
	},
	handleType: function() {
		var that = this;
		var view = this.view.editAsset;
		view.type.on("change",function() {
			var val = $(this).val();
			if (val == "webmap") {
				view.file.removeClass("active");
				view.url.addClass("active");
			} else {
				view.url.removeClass("active");
				view.file.addClass("active");
			}
		})
	},
	geo: {
		map: undefined,
		tiles: undefined,
		marker:undefined,
		view: {
			map:"centroid-map",
			form:undefined,
			lat:undefined,
			lng:undefined
		},
		model: {
			coords: undefined
		},
		init:function() {
			this.view.lat = assetCtrl.view.editAsset.form.find("#latitude");
			this.view.lng = assetCtrl.view.editAsset.form.find("#longitude");
			try {
				var coords = new L.LatLng(this.view.lat.val(),this.view.lng.val());
				this.model.coords = coords;
				this.marker = L.marker(coords)
			} catch (e) {
				this.model.coords = new L.LatLng(0,0);
			};
			this.map = L.map(this.view.map,{
				center: this.model.coords,
				zoom: 2
			})
			this.marker && (this.marker.addTo(this.map));
			this.tiles = new L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
			    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
			    id: localConfig.mapboxId,
			    accessToken: localConfig.mapboxToken
			})
			this.map.addLayer(this.tiles);
			new L.Control.GeoSearch({
			    provider: new L.GeoSearch.Provider.Google(),
			    showMarker: false
			}).addTo(this.map);
			var that = this;
			this.map.on("click",function(e) {
				that.model.coords = e.latlng;
				that.view.lat.val(e.latlng.lat);
				that.view.lng.val(e.latlng.lng);
				that.marker && (that.map.removeLayer(that.marker));
				that.marker = L.marker(that.model.coords).addTo(that.map);
			})
		}
	}
}

$(function() {
	$(assetCtrl).on("templatesReady",function() {
		$("#add-asset .modal-body").html(assetCtrl.templates.editAsset.tpl({opts:localConfig.asset_opts}));
		$("#add-asset").validate();
		$("#site-content").on("click",".edit-toggle",function() {
			var id = $(this).attr("rel");
			$("#edit-asset").attr("action","/asset/"+id);
			$.getJSON("/api/asset/"+id,function(result) {
				result.response.opts = localConfig.asset_opts;
				assetCtrl.model.editAsset = result.response;
				$("#edit-asset .modal-body").html(assetCtrl.templates.editAsset.tpl(assetCtrl.model.editAsset));
				$("#edit-asset").validate();
				assetCtrl.view.editAsset.form = $("#edit-asset");
				assetCtrl.view.editAsset.type = assetCtrl.view.editAsset.form.find("[name=type]");
				assetCtrl.view.editAsset.file = assetCtrl.view.editAsset.form.find("#form-file");
				assetCtrl.view.editAsset.url = assetCtrl.view.editAsset.form.find("#form-url");
				assetCtrl.handleType();
				$("#edit-asset-modal").on("shown.bs.modal",function() {
					assetCtrl.geo.init();
				})
			})
		})		
	})
	assetCtrl.prepTemplates();
	$(".delete-toggle").click(function() {
		$("#delete-asset").attr("action","/asset/"+$(this).attr("rel"));
	})
	
	$("table").DataTable({
		"order": [[0,"desc"]],
      "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ -1 ] }
       ]
	})
})