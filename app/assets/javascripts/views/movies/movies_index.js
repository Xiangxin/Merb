
//Movie Listing View
var MoviesView = Merb.View.extend({
	el : ".row-movies", //the DOM Element class 'movies'
	addOne : function(model){ //function called addOne takes in a model
		
		view = new MovieView({ model: model }); //create a MovieView object specifying the model

		e1 = view.render();
		//var img = $('<img/>').attr({ 'src' : model.get('img_url') })
		//$(e1).append(img);

		$('.row-movies').append(e1);
	},
});



//Single Line Movie View in List
var MovieView = Merb.View.extend({
	tagName: "div",

	events : {
		"click" : "showMovie"
	},

	showMovie : function(){
		AppRouterInst.navigate('/movies/' + this.model.id, true);
		//AppRouter.show_Single_Movie(this.model.id);
	},

	render: function(){ //how to insert into <ul> tag
		//return $(this.el).html(
		//	"<div class='span3 movie'><h3 class='movie-title'>"+ this.model.get("title") +"</h3><img alt='A' src='"+ this.model.get("img_url") +"'></div>" );
		//$(this.el.movie).attr("id",this.model.id);
		//$(this.movie).attr("class","test");
		$(this.el).attr("id",this.model.id);
		$(this.el).attr("class","movie-view");
		var template = _.template($("#movie-template").html(), {model: this.model.toJSON()});
		return $(this.el).html(template);
	}
});

//Detailed Single Movie View
var SingleMovieView = Merb.View.extend({      

 	el: ".testa",
 		
	events : {
		"click #update_movie_btn": "update_movie",
		"click #delete-movie-btn": "delete_movie",
		"click #submit": "create_review",
	},

	render: function () {
		var template = _.template($("#single-movie-template").html(), {model: this.model.toJSON()});
	 	this.$el.html(template);
	 	var reviews_view = new ReviewsView({collection:this.model.reviews});
		reviews_view.render(this.model.reviews);
		this.reviews_view = reviews_view;
		if (!userLoggedIn()) {
			$("#update_movie_btn").hide();
			$("#delete-movie-btn").hide();
			$("#create-review").hide();
		}

		$(".single-movie").focus();
		return this;
	},

	update_movie: function() {
		if(!userLoggedIn) {
			alert("Sorry but please log in first!");
			return;
		}
		window.location.href = "/#edit/" + this.model.id;
	},

	delete_movie: function () {
		var token = getCookie('token');
		if (token == "" || token == null) {
			alert("Sorry but please log in first!");
			return;
		}

		var id = this.model.id;

		$.ajax({
        	url: "http://cs3213.herokuapp.com/movies/" + this.model.id + ".json",
        	type: 'delete',
        	dataType: 'json',
        	data: {'access_token': token},
        	error: function(jqXHR, textStatus, error) {
        	 	console.log(textStatus + ": " + error);
        	 	//alert('Oops an error occurred.');
        	 	if (error == 'Unauthorized') {
        	 		alert('This is not your movie!');
        	 		window.location.href = "/#movies/" + id;
        	 	}
      		}, 
        	success: function(data) {
        		console.log("success!");
        	    window.location.href = "/";
        	}
     	}); 
	},

	create_review: function(){
 		var token = getCookie("token");
 		var score = $.trim($("#review_score").val());
 		var comment = $.trim($("#review_comment").val());
 		if(score < 1 || score > 100) {
			alert("Please enter a score between 1 and 100");
    		return;
		}

		var movie_id = this.model.id;

		var data = {
	      	'movie_id': movie_id,
	      	'score': score,
	      	'comment': comment,
	      	'access_token': token,
    	};

    	var self = this;
    	$("#submit").text("Creating...").attr('disabled', 'disabled');
	    var url = "http://cs3213.herokuapp.com/movies/" + movie_id + "/reviews.json";
	    $.ajax({
	        url: url,
	        type: "POST",
	        dataType: "json",
	        headers: {'Content-Type':'application/json'},
	        data: JSON.stringify(data),
	        success: function(result) {
	        	$("#submit").text("Create").removeAttr("disabled");
	            console.log(result);
	            data.user = result.user;
	            data.id = result.id;
	            var newReview = new Review(data);
	            newReview.collection = self.model.reviews;
	            self.model.reviews.push(newReview);
    			self.reviews_view.addOne(newReview);
    			$("#review_score").val('');
    			$("#review_comment").val('');
	        },
	        error: function (xhr, status, err) {
	        	$("#submit").text("Create Review").removeAttr("disabled"); 
	            console.log(xhr);
	       	 }
	    });
	},
});



var UpdateMovieView = Merb.View.extend({
	render: function(){

		var template = _.template($("#update-movie-template").html(), {model: this.model.attributes});
		$('.testa').html(template);

		if (userLoggedIn()) {
			alert("Sorry but please log in first!");
			return;
		}
 		$('#update_title').val(this.model.attributes.title);
 		$('#update_summary').val(this.model.attributes.summary);
 		var id = this.model.id;

        $('#cancel-update-btn').click(function(){
            window.location.href = "/#movies/" + id;
        });

 		$("#update-btn").click(function(){

			var summary, title, img; 
			title = $.trim($('#update_title').val());
			summary = $.trim($('#update_summary').val());
			img = $("update_image").val();

			if (title == "" || summary == "") {
		           alert("Please provide complete data!");
		    } else {
		    	   $("#update-btn").text("Updating...").attr('disabled', 'disabled');
		           var formData = new FormData();

		           console.log('new: ' + id + ", " + title + ", " + summary);

		           formData.append('id', id);
		           formData.append('title', title);
		           formData.append('summary', summary);
		           if(img != "") {
		           		formData.append('img', img);
		           }
		           formData.append("access_token", token);
		           $.ajax({
		            	url: "http://cs3213.herokuapp.com/movies/" + id + ".json",
		            	type: "put",
		            	data: formData,
		            	cache: false,
		            	contentType: false,
		            	processData: false,
		            	error: function(xhr, textStatus, error) {
                    	 	console.log(xhr);
                    	 	if (error == 'Unauthorized') {
                    	 		alert('This is not your movie!');	                  
                    	 	}
                    	 	$("#update-btn").text("Update").removeAttr("disabled"); 
                    	 	window.location.href = '/#movies/' + id;
                  		}, 
		            	success: function(data) {
		            		console.log("success!");

		            		$("#update-btn").text("Update").removeAttr("disabled");
		            	    window.location.href = "/#movies/" + id;
		            	}
		         }); 
		    }
		});    
	},
});



var CreateMovieView = Merb.View.extend({
    render: function() {
        var template = _.template($("#add-movie-template").html(), {});
        $('.testa').html(template);

		$("#submit-btn").click(function(){

			var token = getCookie('token');
			console.log(token);

			var summary, title, img; 
			title = $.trim($('#movie_title').val());
			summary = $.trim($('#movie_summary').val());
			img = $('#movie_img').val();

			
				if (title == "" || summary == "" || img == "") {
			           alert("Please provide complete data!");
			    } else {
			    	   $("#submit-btn").text("Creating...").attr('disabled', 'disabled');
			           var formData = new FormData($("#new_movie_form")[0]);
			           formData.append("access_token", token)
			           $.ajax({
			            	url: "http://cs3213.herokuapp.com/movies.json",
			            	type: "post",
			            	data: formData,
			            	cache: false,
			            	contentType: false,
			            	processData: false,
			            	error: function(jqXHR, textStatus, error) {
	                    	 	console.log(textStatus + ": " + error);
	                    	 	// alert('Your authentication has expired.');
	                    	 	window.location.href = '/';
	                    	 	$("#submit-btn").text("Create").removeAttr("disabled"); 
	                  		}, 
			            	success: function(data) {
			            		console.log("success!");
			            		$("#submit-btn").text("Create").removeAttr("disabled");
			            	    window.location.href = "/#movies/" + data.id;
			            	}
			         }); 
			    }
			});    
        return this;
    },
});

