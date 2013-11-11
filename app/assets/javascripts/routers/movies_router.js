var AppRouter = Merb.Router.extend({
      routes: {
            //Display Page
            "index"           : "index",
            ""                 : "index",
            "#/"               : "index",
            "page/:page_num"   : "show_page", 
            "movies/:id"       : "show_single_movie",
            "new_movie"       : "new_movie",
            "edit/:id"        : "update_movie",
      },

      index: function() {
            AppViewInst.showPage(1);
      },

      show_page: function(page_num) {
            AppViewInst.showPage(page_num);
      },

      show_single_movie : function (movie_id){
            AppViewInst.showSingleMovieView(movie_id);
      },

      new_movie: function() {
            AppViewInst.createMovieView();
      },

      update_movie: function(movie_id) {
            AppViewInst.updateMovieView(movie_id);
      }
});

