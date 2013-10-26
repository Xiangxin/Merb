var ReviewView = Merb.View.extend({
	tagName: "li",

	events : {
		"click .icon-remove": "delete_review",
	},
	
	render: function () {
		var template = _.template($("#movie-review-template").html(), {model: this.model.toJSON()});
	 	this.$el.html(template);
		return this;
	},

	delete_review: function(){
		var movie_id = this.model.attributes.movie_id;
		var review_id = this.model.id;
		var token = getCookie("token");
	 	var url = "http://cs3213.herokuapp.com/movies/" + movie_id + "/reviews/" + review_id + ".json";

	    $.ajax({
		    type: "delete",
        	url: url,
        	data: {'access_token': token},
		    success: function(result) {
		    	
        	},
        	error: function (xhr, status, err) {
            	console.log(xhr);
       		}
    	});
	},
});

var ReviewsView = Merb.View.extend({

	el: "#review-list",

	addOne: function (review) {
		var view = new ReviewView({model: review});
		$('#review-list').append(view.render().el);
	},

	render: function(collection) {
		_.each(collection.models, function(review) {
			var view = new ReviewView({model: review});
			$('#review-list').append(view.render().el);
		});
	},
});
