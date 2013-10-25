var ReviewList = Merb.Collection.extend({
	model: Review,
	url : function(){
		return "http://cs3213.herokuapp.com/movies/" + this.id + "/reviews.json"
	},
});