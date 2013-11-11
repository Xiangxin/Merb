(function(){

    var Merb = this.Merb = {};

    ////////////////
    // Merb Event //
    ////////////////

    var Events = Merb.Events = {

        on: function(name, callback, context) {
            if (!callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({callback: callback, context: context, ctx: context || this});
            return this;
        },

        trigger: function(name) {
            if (!this._events) return this;
            var args = [].slice.call(arguments, 1);
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },
    };

    var triggerEvents = function(events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
          case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
          case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
          case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
          case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
          default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
        }
    };

    
    Events["listenTo"] = function(obj, name, callback) {
        var listeners = this._listeners || (this._listeners = {});
        var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
        listeners[id] = obj;
        if (typeof name === 'object') callback = this;
        obj["on"](name, callback, this);
        return this;
    };

  
  ////////////////
  // Merb Model //
  ////////////////

  var Model = Merb.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId('c');
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  _.extend(Model.prototype, Events, {

    initialize: function(){},

    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    sync: function() {
      return Merb.sync.apply(this, arguments);
    },

    set: function(key, val, options) {
      var attr, attrs, unset, changes, silent, changing, prev, current;
      if (key == null) return this;

      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      if (!this._validate(attrs, options)) return false;

      unset           = options.unset;
      silent          = options.silent;
      changes         = [];
      changing        = this._changing;
      this._changing  = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }
      current = this.attributes, prev = this._previousAttributes;

      if ("id" in attrs) this.id = attrs["id"];

      for (attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          this.changed[attr] = val;
        } else {
          delete this.changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      if (!silent) {
        if (changes.length) this._pending = true;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    fetch: function(options) {
      options = options ? _.clone(options) : {};
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        if (!model.set(resp, options))
          return false;
        if (success) success(model, resp, options);
          model.trigger('sync', model, resp, options);
      };
      return this.sync('get', this, options);
    },

    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;

      var destroy = function() {
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (options.wait || model.isNew()) destroy();
        if (success) success(model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      if (this.isNew()) {
        options.success();
        return false;
      }

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    parse: function(resp, options) {
      return resp;
    },

    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options || {}, {validationError: error}));
      return false;
    }

  });


  /////////////////////
  // Merb Collection //
  /////////////////////

  var Collection = Merb.Collection = function() {
      this._reset();
  };

  _.extend(Collection.prototype, Events, {

        model: Model,

        _reset: function() {
          if(this.models) {
            for (var i = 0, l = this.models.length; i < l; i++) {
              this._removeReference(this.models[i]);
            }  
          }
          this.length = 0;
          this.models = [];
          this._byId  = {};
        },

        // add a model to collection
        add: function(model) {
          var existing_model = this.get(model);
          if(existing_model) return;

          options = {add: true, merge: false, remove: false};
          var model = this._prepareModel(model, options);
          model.on('all', this._onModelEvent, this);
          this._byId[model.cid] = model;
          if (model.id != null) this._byId[model.id] = model;
          this.length += 1;
          this.models.push(model);
          model.trigger('add', model, this, options);
          return this;
        },

        // remove a model from collection
        remove: function(model) {      
          var existing_model = this.get(model);
          if (existing_model) {
            delete this._byId[existing_model.id];
            delete this._byId[existing_model.cid];
            index = _.indexOf(this.models, existing_model);
            this.models.splice(index, 1);
            this.length--;
            model.trigger('remove', existing_model, this, {'index':index});
            this._removeReference(existing_model);
          }
          return this;
        },

        fetch: function(options) {
          options = options ? _.clone(options) : {};
          options.parse = true;
          var success = options.success;
          var collection = this;
          options.success = function(resp) {
            collection._reset();
            for(var i = 0; i < resp.length; i++) {
              collection['add'](resp[i]);
            }
            
            if (success) 
              success(collection);
            
            collection.trigger('sync', collection, resp, options);
          };
          return this.sync('get', this, options);
        },

        toJSON: function(options) {
          return this.map(function(model){ return model.toJSON(options); });
        },

        sync: function() {
          return Merb.sync.apply(this, arguments);
        },

        get: function(obj) {
          if (obj == null) return void 0;
          return this._byId[obj.id != null ? obj.id : obj.cid || obj];
        },

        _prepareModel: function(attrs, options) {
            if (attrs instanceof Model) {
              if (!attrs.collection) attrs.collection = this;
              return attrs;
            }
            options || (options = {});
            options.collection = this;
            var model = new this.model(attrs, options);
            if (!model._validate(attrs, options)) {
              this.trigger('invalid', this, attrs, options);
              return false;
            }
            return model;
        },

        _removeReference: function(model) {
          if (this === model.collection) delete model.collection;
        },

        _onModelEvent: function(event, model, collection, options) {
          if ((event === 'add' || event === 'remove') && collection !== this) return;
          if (event === 'destroy') this.remove(model, options);
          if (model && event === 'change:' + model.idAttribute) {
            delete this._byId[model.previous(model.idAttribute)];
            if (model.id != null) this._byId[model.id] = model;
          }
          this.trigger.apply(this, arguments);
        }
});


  ///////////////
  // Merb View //
  ///////////////

    var View = Merb.View = function(options) {
        this.cid = _.uniqueId('view');
        this._configure(options || {});
        this._initView();
    };

    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    var viewOptions = ['model', 'collection', 'el', 'tagName', 'events'];

    _.extend(View.prototype, Events, {

        // DOM Events handling
        $: function(selector) {
            return this.$el.find(selector);
        },

        render: function() {
          return this;
        },

        remove: function() {
          this.$el.remove();
          return this;
        },

        _initView: function() {

            var element = this.el;
            if (!element) {
                var attrs = _.extend({}, _.result(this, 'attributes'));
                var tagName = this.tagName;
                if(!tagName) tagName = 'div';
                element = $('<' + tagName + '>').attr(attrs);
            }

            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof $ ? element : $(element);
            this.el = this.$el[0];
            this.delegateEvents();
            return this;
        },

        delegateEvents: function(events) {
          if (!(events || (events = _.result(this, 'events')))) return this;
          this.undelegateEvents();
          for (var key in events) {
            var method = events[key];
            if (!_.isFunction(method)) method = this[events[key]];
            if (!method) continue;

            var match = key.match(delegateEventSplitter);
            var eventName = match[1], selector = match[2];
            method = _.bind(method, this);
            eventName += '.delegateEvents' + this.cid;
            if (selector === '') {
              this.$el.on(eventName, method);
            } else {
              this.$el.on(eventName, selector, method);
            }
          }
          return this;
        },

        undelegateEvents: function() {
          this.$el.off('.delegateEvents' + this.cid);
          return this;
        },

        _configure: function(options) {
          if (this.options) options = _.extend({}, _.result(this, 'options'), options);
          _.extend(this, _.pick(options, viewOptions));
          this.options = options;
        },
    });


/////////////
//  Sync   //
/////////////

    Merb.sync = function(method, model, options) {

        var params = {type: method, dataType: 'json', contentType:'application/json'};

        if (!options.url) {
          throw new Error("Merb Doesn't know where to fetch. URL is missing.");
        }

        if (options.data == null && model && (method === 'POST' || method === 'PUT')) {
            params.data = JSON.stringify(options.attrs || model.toJSON(options));
        }

        var xhr = options.xhr = $.ajax(_.extend(params, options));
        model.trigger('request', model, xhr, options);
        return xhr;
    };

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

  ///////////////
  //  Router   //
  ///////////////

    var Router = Merb.Router = function(options) {
        options || (options = {});
        if (options.routes) this.routes = options.routes;
        this._bindRoutes();
        this.initialize.apply(this, arguments);
    };
    var optionalParam = /\((.*?)\)/g;
    var namedParam    = /(\(\?)?:\w+/g;
    var splatParam    = /\*\w+/g;
    var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    _.extend(Router.prototype, Events, {

        initialize: function(){},

        route: function(route, name, callback) {
            if (!_.isRegExp(route)) route = this._routeToRegExp(route);
            if (_.isFunction(name)) {
              callback = name;
              name = '';
            }
            if (!callback) callback = this[name];
            var router = this;
            Merb.history.route(route, function(fragment) {
              var args = router._extractParameters(route, fragment);
              callback && callback.apply(router, args);
              router.trigger.apply(router, ['route:' + name].concat(args));
              router.trigger('route', name, args);
              Merb.history.trigger('route', router, name, args);
            });
            return this;
        },
        navigate: function(fragment, options) {
          Merb.history.navigate(fragment, options);
          return this;
        },
        _bindRoutes: function() {
          if (!this.routes) return;
          this.routes = _.result(this, 'routes');
          var route, routes = _.keys(this.routes);
          while ((route = routes.pop()) != null) {
            this.route(route, this.routes[route]);
          }
        },
        _routeToRegExp: function(route) {
          route = route.replace(escapeRegExp, '\\$&')
                       .replace(optionalParam, '(?:$1)?')
                       .replace(namedParam, function(match, optional){
                         return optional ? match : '([^\/]+)';
                       })
                       .replace(splatParam, '(.*?)');
          return new RegExp('^' + route + '$');
        },
        _extractParameters: function(route, fragment) {
          var params = route.exec(fragment).slice(1);
          return _.map(params, function(param) {
            return param ? decodeURIComponent(param) : null;
          });
        }
  });

  ///////////////
  //  History  //
  ///////////////
  
    var History = Merb.History = function() {
        this.handlers = [];
        _.bindAll(this, 'checkUrl');
        if (typeof window !== 'undefined') {
          this.location = window.location;
          this.history = window.history;
        }
    };
    var routeStripper = /^[#\/]|\s+$/g, rootStripper = /^\/+|\/+$/g, isExplorer = /msie [\w.]+/, trailingSlash = /\/$/;
    History.started = false;
    _.extend(History.prototype, Events, {
        interval: 50,
        getHash: function(window) {
            var match = (window || this).location.href.match(/#(.*)$/);
            return match ? match[1] : '';
        },
        getFragment: function(fragment, forcePushState) {
          if (fragment == null) {
            if (this._hasPushState || !this._wantsHashChange || forcePushState) {
              fragment = this.location.pathname;
              var root = this.root.replace(trailingSlash, '');
              if (!fragment.indexOf(root)) fragment = fragment.substr(root.length);
            } else {
              fragment = this.getHash();
            }
          }
          return fragment.replace(routeStripper, '');
        },
        start: function(options) {
          if (History.started) throw new Error("Merb.history has already been started");
          History.started = true;
          this.options          = _.extend({}, {root: '/'}, this.options, options);
          this.root             = this.options.root;
          this._wantsHashChange = this.options.hashChange !== false;
          this._wantsPushState  = !!this.options.pushState;
          this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
          var fragment          = this.getFragment();
          var docMode           = document.documentMode;
          var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));
          this.root = ('/' + this.root + '/').replace(rootStripper, '/');
          if (oldIE && this._wantsHashChange) {
            this.iframe = $('<iframe src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
            this.navigate(fragment);
          }
          if (this._hasPushState) {
            $(window).on('popstate', this.checkUrl);
          } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
            $(window).on('hashchange', this.checkUrl);
          } else if (this._wantsHashChange) {
            this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
          }
          this.fragment = fragment;
          var loc = this.location;
          var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;
          if (this._wantsHashChange && this._wantsPushState && !this._hasPushState && !atRoot) {
            this.fragment = this.getFragment(null, true);
            this.location.replace(this.root + this.location.search + '#' + this.fragment);
            return true;
          } else if (this._wantsPushState && this._hasPushState && atRoot && loc.hash) {
            this.fragment = this.getHash().replace(routeStripper, '');
            this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
          }

            if (!this.options.silent) return this.loadUrl();
        },
        route: function(route, callback) {
          this.handlers.unshift({route: route, callback: callback});
        },
        checkUrl: function(e) {
          var current = this.getFragment();
          if (current === this.fragment && this.iframe) {
            current = this.getFragment(this.getHash(this.iframe));
          }
          if (current === this.fragment) return false;
          if (this.iframe) this.navigate(current);
          this.loadUrl() || this.loadUrl(this.getHash());
        },
        loadUrl: function(fragmentOverride) {
          var fragment = this.fragment = this.getFragment(fragmentOverride);
          var matched = _.any(this.handlers, function(handler) {
            if (handler.route.test(fragment)) {
              handler.callback(fragment);
              return true;
            }
          });
          return matched;
        },
        navigate: function(fragment, options) {
          if (!History.started) return false;
          if (!options || options === true) options = {trigger: options};
          fragment = this.getFragment(fragment || '');
          if (this.fragment === fragment) return;
          this.fragment = fragment;
          var url = this.root + fragment;

          if (this._hasPushState) {
            this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

          } else if (this._wantsHashChange) {
            this._updateHash(this.location, fragment, options.replace);
            if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
              if(!options.replace) this.iframe.document.open().close();
              this._updateHash(this.iframe.location, fragment, options.replace);
            }
          } else {
            return this.location.assign(url);
          }
          if (options.trigger) this.loadUrl(fragment);
        },
        _updateHash: function(location, fragment, replace) {
          if (replace) {
            var href = location.href.replace(/(javascript:|#).*$/, '');
            location.replace(href + '#' + fragment);
          } else {
            location.hash = '#' + fragment;
          }
          },
    });
    Merb.history = new History;
  

    var extend = function(protoProps) {
        var parent = this;
        var child = function(){ return parent.apply(this, arguments); };
        _.extend(child, parent);
        var Surrogate = function(){ this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;
        if(protoProps)
          _.extend(child.prototype, protoProps);
        child.__super__ = parent.prototype;
        return child;
    };

  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

}).call(this);