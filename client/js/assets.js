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
				result.opts = localConfig.asset_opts;
				$("#edit-asset .modal-body").html(assetCtrl.templates.editAsset.tpl(result));
				$("#edit-asset").validate();
			})
		})		
	})
	assetCtrl.prepTemplates();
	/*$("#add-toggle").click(function() {
		$(this).toggleClass("btn-success");
		$("#add-asset").toggleClass("open");
	})*/
	$(".delete-toggle").click(function() {
		$("#delete-asset").attr("action","/asset/"+$(this).attr("rel"));
	})
	
	$("table").DataTable({
      "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ -1 ] }
       ]
});
})