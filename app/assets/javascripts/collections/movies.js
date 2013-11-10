var Movies = Merb.Collection.extend({
	model : Movie,

	pagination : function(page) {
		this.url = url + page.toString();
       	page = page-1;
       	var collection = this;
       	collection = _(collection.rest(perPage * page));
       	collection = _(collection.first(perPage));    
       	return collection.map( function(model) { return model.toJSON() } ); 
	}
});

	
