var Movie = Merb.Model.extend({ 

	url : function(){
		return "http://cs3213.herokuapp.com/movies/" + this.get('id') + ".json"
	},
	
	initialize: function() {
	    this.reviews = new Reviews();
		this.reviews.url = "http://cs3213.herokuapp.com/movies/" + this.attributes.id + "/reviews.json";
	}
});