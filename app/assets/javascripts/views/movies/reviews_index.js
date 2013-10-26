var ReviewView = Merb.View.extend({
	tagName: "li",

	events : {
		"click .icon-remove": "delete_review",
	},
	
	render: function() {
		var template = _.template($("#movie-review-template").html(), {model: this.model.toJSON()});
	 	this.$el.html(template);
		return this;
	},

	delete_review: function(){
		var movie_id = this.model.attributes.movie_id;
		var review_id = this.model.id;
		var token = getCookie("token");
	 	var url = "http://cs3213.herokuapp.com/movies/" + movie_id + "/reviews/" + review_id + ".json";
	 	var coll = this.model.collection;
	 	var mdl = this.model;

	    $.ajax({
		    type: "delete",
        	url: url,
        	data: {'access_token': token},
		    success: function(result) {
		    	coll.remove(mdl);
		    	var reviews_view = new ReviewsView();
				reviews_view.render(coll);
        	},
        	error: function (xhr, status, err) {
        		console.log(xhr);
        		if(xhr.status == 401) {
        			alert('Sorry but can only delete your own reviews.');
        		}
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
		$('#review-list').empty();
		_.each(collection.models, function(review) {
			var view = new ReviewView({model: review});
			$('#review-list').append(view.render().el);
		});
	},
});
