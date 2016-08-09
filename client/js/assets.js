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
				$.get("js/views/"+key+".handlebars",function(result) {
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
		Handlebars.registerHelper('log', function(context) {
			console.log(context);
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
		Handlebars.registerHelper('eachAtIndex',function(array,index,options) {
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
		})
	},
	view: {
		asset: {
			form: undefined,
			type: undefined,
			file: undefined,
			url: undefined
		}
	},
	model: {
		asset: undefined
	},
	setModalHandlers: function() {
		this.view.asset.type = this.view.asset.form.find("[name=type]");
		this.view.asset.file = this.view.asset.form.find("#form-file");
	}

}

$(function() {
	$(assetCtrl).on("templatesReady",function() {
		$("#add-asset .modal-body").html(assetCtrl.templates.editAsset.tpl({opts:localConfig.asset_opts}));
		$("#add-asset").validate();
		$("#site-content").on("click","#add-toggle",function() {
			assetCtrl.view.asset.form = $("#add-asset");
			assetCtrl.view.asset.modal = $("#add-asset-modal");
			assetCtrl.setModalHandlers();
		})
		$("#site-content").on("click",".edit-toggle",function() {
			var id = $(this).attr("rel");
			$("#edit-asset").attr("action","asset/"+id);
			$.getJSON("api/asset/"+id,function(result) {
				result.response.opts = localConfig.asset_opts;
				assetCtrl.model.asset = result.response;
				$("#edit-asset .modal-body").html(assetCtrl.templates.editAsset.tpl(assetCtrl.model.asset));
				$("#edit-asset").validate();
				assetCtrl.view.asset.form = $("#edit-asset");
				assetCtrl.view.asset.modal = $("#edit-asset-modal");
				assetCtrl.setModalHandlers();
			})
		})
	})
	assetCtrl.prepTemplates();
	$(".delete-toggle").click(function() {
		$("#delete-asset").attr("action","asset/"+$(this).attr("rel"));
	})

	$("table").DataTable({
		"order": [[0,"desc"]],
      "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ -1 ] }
       ]
	})
})
