var userCtrl = {
	templates: {
		editUser:{}
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
		Handlebars.registerHelper('eq',function(v1,v2,options) {
			if (v1 && v2 && v1.toString() === v2.toString()) {  
				return options.fn(this);
			}
			return options.inverse(this);
		})
	}
}

$(function() {
	$(userCtrl).on("templatesReady",function() {
		$("#add-user .modal-body").html(userCtrl.templates.editUser.tpl());
		$("#add-user").validate();
		$("#site-content").on("click",".edit-toggle",function() {
			var email = $(this).attr("rel");
			$("#edit-user").attr("action","/user/"+email);
			$.getJSON("/api/user/"+email,function(result) {
				result.edit = true;
				$("#edit-user .modal-body").html(userCtrl.templates.editUser.tpl(result));
				$("#edit-user").validate();
			});
		})		
	})
	userCtrl.prepTemplates();
	$(".delete-toggle").click(function() {
		$("#delete-user").attr("action","/user/"+$(this).attr("rel"));
	})
	
	$("table").DataTable({
      "aoColumnDefs": [
          { 'bSortable': false, 'aTargets': [ -1 ] }
       ]
  	})
});