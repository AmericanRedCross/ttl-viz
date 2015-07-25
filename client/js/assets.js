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
				assetCtrl.view.editAsset.type = $("#edit-asset [name=type]");
				assetCtrl.view.editAsset.file = $("#edit-asset #form-file");
				assetCtrl.view.editAsset.url = $("#edit-asset #form-url");
				assetCtrl.handleType();
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