window.MovieReview = {
    Models: {},
    Collections: {},
    Views: {},
    Routers: {},
    initialize: function() {
    	window.AppRouterInst = new AppRouter();
    	window.AppViewInst = new AppView();
        Merb.history.start();
    }
};

$(document).ready(function() {
  	return MovieReview.initialize();
});


