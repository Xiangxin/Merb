var Movie = Merb.Model.extend({ 

	url : function(){
		return "http://cs3213.herokuapp.com/movies/" + this.get('id') + ".json"
	},
	
	initialize: function() {
	    this.reviews = new ReviewList();
		this.reviews.url = "http://cs3213.herokuapp.com/movies/" + this.attributes.id + "/reviews.json";
	}
});