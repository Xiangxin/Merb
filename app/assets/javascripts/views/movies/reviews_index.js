var ReviewView = Merb.View.extend({
	tagName: "li",
	
	events : {
		"click #submit": "create_review",
		"click .icon-remove": "delete_review"
	},

	render: function (review_id) {
		var template = _.template($("#movie-review-template").html(), {model: this.model.toJSON()});
	 	this.$el.html(template);
		return this;
	},

	delete_review: function(){
		var movie_id = $(this).attr("movie_id");
		var review_id = $(this).attr("review_id");
		var token = getCookie("token");
		console.log(movie_id);
		console.log(review_id);
		console.log(token);
 		var url = "http://cs3213.herokuapp.com/movies/" + movie_id + "/reviews/" + review_id + ".json";

	    $.ajax({
		    type: "delete",
        	url: url,
        	data: {'access_token': token},
		    success: function(result) {
		        AppRouterInst.navigate("/#movies/"+movie_id, true);
        	},
        	error: function (xhr, status, err) {
            	console.log(xhr);
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
		var data = {
	      	'movie_id': movie_id,
	      	'score': score,
	      	'comment': comment,
	      	'access_token': token
    	};

    	// this.model.collection.create(data);

	    var url = "http://cs3213.herokuapp.com/movies/" + movie_id + "/reviews.json";
	    $.ajax({
	        url: url,
	        type: "POST",
	        dataType: "json",
	        headers: {'Content-Type':'application/json'},
	        data: JSON.stringify(data),
	        success: function(result) {
	            AppRouterInst.navigate("/#movies/"+movie_id, true	);
	        },
	        error: function (xhr, status, err) {
	            console.log(xhr);
	       	 }
	    });
	},
});

var ReviewsView = Merb.View.extend({

	el: "#review-list",

	// initialize: function () {
	// 	this.listenTo(this.model, 'add', this.addOne);
	// 	//this.listenTo(this.model, 'destroy', this.remove);
	// },

	addOne: function (review) {
		var view = new ReviewView({model: review});
		$('#review-list').append(view.render().el);
	},
});
