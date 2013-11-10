(function(){

  var Merb = this.Merb = {};
  
  ////////////////
  // Merb Event //
  ////////////////

  var Events = Merb.Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = [].slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }
    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Merb events have 3 arguments).
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

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  
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

  // Attach all inheritable methods to the Model prototype.
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

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
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

      // For each `set` attribute, update or delete the current value.
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

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = true;
        for (var i = 0, l = changes.length; i < l; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
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
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      var attrs, method, xhr, attributes = this.attributes;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      // If we're not waiting and attributes exist, save acts as `set(attr).save(null, opts)`.
      if (attrs && (!options || !options.wait) && !this.set(attrs, options)) return false;

      options = _.extend({validate: true}, options);

      // Do not persist invalid models.
      if (!this._validate(attrs, options)) return false;

      // Set temporary attributes if `{wait: true}`.
      if (attrs && options.wait) {
        this.attributes = _.extend({}, attributes, attrs);
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      if (options.parse === void 0) options.parse = true;
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = model.parse(resp, options);
        if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
        if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
          return false;
        }
        if (success) success(model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      // wrapError(this, options);

      method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch') options.attrs = attrs;
      xhr = this.sync(method, this, options);

      // Restore attributes.
      if (attrs && options.wait) this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
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
      // wrapError(this, options);

      var xhr = this.sync('delete', this, options);
      if (!options.wait) destroy();
      return xhr;
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // // Run validation against the next complete set of model attributes,
    // // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
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

  // Define the Collection's inheritable methods.
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
          return this.sync('read', this, options);
        },

        // The JSON representation of a Collection is an array of the
        // models' attributes.
        toJSON: function(options) {
          return this.map(function(model){ return model.toJSON(options); });
        },

        // Proxy `Merb.sync` by default.
        sync: function() {
          return Merb.sync.apply(this, arguments);
        },

        get: function(obj) {
          if (obj == null) return void 0;
          return this._byId[obj.id != null ? obj.id : obj.cid || obj];
        },

        // Prepare a hash of attributes (or other model) to be added to this
        // collection.
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

        // Internal method to sever a model's ties to a collection.
        _removeReference: function(model) {
          if (this === model.collection) delete model.collection;
          model.off('all', this._onModelEvent, this);
        },

        // Internal method called every time a model in the set fires an event.
        // Sets need to update their indexes when models change ids. All other
        // events simply proxy through. "add" and "remove" events that originate
        // in other collections are ignored.
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
          this.stopListening();
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



  Merb.sync = function(method, model, options) {
    var type = methodMap[method];

    var params = {type: type, dataType: 'json'};

    if (!options.url) {
      throw new Error("Merb Doesn't know where to fetch. URL is missing.");
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // If we're sending a `PATCH` request, and we're in an old Internet Explorer
    // that still has ActiveX enabled by default, override jQuery to use that
    // for XHR instead. Remove this line when jQuery supports `PATCH` on IE8.
    if (params.type === 'PATCH' && noXhrPatch) {
      params.xhr = function() {
        return new ActiveXObject("Microsoft.XMLHTTP");
      };
    }

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = $.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  var noXhrPatch = typeof window !== 'undefined' && !!window.ActiveXObject && !(window.XMLHttpRequest && (new XMLHttpRequest).dispatchEvent);

  // Map from CRUD to HTTP for our default `Merb.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
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
