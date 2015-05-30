var ctrl = {
	setHandlers:function() {
		$("#nav-toggle").on("click",function() {
			$("body").toggleClass("navopen");
		})
	}
}

$(function() {
	ctrl.setHandlers();
})