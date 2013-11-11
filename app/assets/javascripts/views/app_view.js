var movies = new Movies();

var AppView = Merb.View.extend({
	//el: set element of main div changing

	showPage: function(pageNum){
       //movies.url = movies.url + "?" + $.param({page: pageNum});

        $('#pagination').show();
        $("div.row-movies").empty();

        movies.fetch({
            //using jquery param method to add param to url
            data: $.param({page: pageNum}),

            url : "http://cs3213.herokuapp.com/movies.json",
              
            //upon success, run function
            success : function(data){

                // movies.reset(data.models)
                movies_view = new MoviesView({ }) //create collection view
                _.each(movies.models, function(model){ //for each movie model in the collection, pass in that model
                      movies_view.addOne(model); //execute addOne method
                });

                //get previous and next page numbers from current page number
                var prev_page_num = parseInt(pageNum) - 1;
                if (prev_page_num < 1){
                    prev_page_num = 1;
                }
                var next_page_num = parseInt(pageNum) + 1;

                if (movies.models.length < 30) {
                    $('#nextPage').hide(); 
                } else {
                    $('#nextPage').show(); 
                    $('#nextPage').attr("href", "/#page/"+next_page_num);
                }

                //set the html elements
                if (pageNum == 1) {
                    $('#prevPage').hide();
                } else {
                    $('#prevPage').show();
                    $('#prevPage').attr("href", "/#page/"+prev_page_num);
                }
               

            },

            error: function(error){
                console.log(error);
            }
        });
	},

	showSingleMovieView: function(movie_id){
        $('#pagination').hide();
        var movie = new Movie({id: movie_id});
        movie.url = "http://cs3213.herokuapp.com/movies/" + movie_id + ".json"

        movie.fetch({

            url: "http://cs3213.herokuapp.com/movies/" + movie_id + ".json",

            success : function(thisMovie){
                thisMovie.reviews.fetch({

                    url: "http://cs3213.herokuapp.com/movies/" + movie.id + "/reviews.json",
                    success: function(thisMovieReviews) {
                        thisMovie.set("reviews", thisMovieReviews);
                        var view = new SingleMovieView({model: movie});
                        view.render();
                        return this;
                    }
                });
            }
        });
    },

	createMovieView: function(){
        $('#pagination').hide();
        var view = new CreateMovieView();
        view.render();
	},

    updateMovieView: function(movie_id){
        $('#pagination').hide();
        var movie = new Movie({id: movie_id});
        movie.url = "http://cs3213.herokuapp.com/movies/"+movie_id+".json"

        movie.fetch({
            url: movie.url,

            success : function(thisMovie){
                thisMovie.reviews.fetch({
                    url: "http://cs3213.herokuapp.com/movies/" + movie.id + "/reviews.json",

                    success: function(thisMovieReviews) {
                        thisMovie.set("reviews", thisMovieReviews);
                        var view = new UpdateMovieView({model: movie});
                        view.render();
                        return this;
                    }
                });
            }
        });
    }
});
      