(function (root) {

	"use strict";

	Array.prototype.indexOf = Array.prototype.indexOf || function (a, b, c, r) {
		for (b = this, c = b.length, r = -1; ~c; r = b[--c] === a ? c : r);
		return r;
	};

	var _loadQ = [],
		_defineQ = [],
		_loadedFiles = {},
		_modules = {},
		_head,
		// Used for checking circular dependencies.
		_dependencies = {},

		// Configurable properties...
		_baseUrl = "",
		_urlArgs = "",
		_paths = {},
		// Defaults to "10". Number of seconds before giving up on a file request
		_waitSeconds = 10;

	function _isArray (a) {
		return a instanceof Array;
	}

	function _normalize (path, prevPath) {

		// Replace any matches of "./"  with "/"
		path = path.replace(/(?:^|[^\.])(\.\/)/g, "/");

		// Replace any matches of "some/path/../" with "some/"
		while (prevPath !== path) {
			prevPath = path;
			path = path.replace(/([\w,\-]*[\/]{1,})([\.]{2,}\/)/g, "/");
		}

		// Replace any matches of "//..." with a single "/"
		path = path.replace(/(\/{2,})/g, "/");
		// If the path starts with a leading "/", remove it.
		return path.charAt(0) === "/" ? path.substr(1) : path;
	}

	function _getContext (path) {
		return path.substr(0, path.lastIndexOf("/"));
	}

	function _resolve (path, basePath) {
		return _normalize((basePath || "") + "/" + path);
	}

	function _checkLoadQ (i, j, q, ready) {
		/* 
		* ~ will return truthy for anything other than -1, just another way of doing >= 0
		* it is less clear, but I'm all about the micro optimizations.
		*/
		for (i = _loadQ.length - 1; ~i; i --) {

			ready = 1;
			q = _loadQ[i];

			for (j = q.m.length - 1; ~j; j --) {
				if (!_module(q.m[j])) {
					ready = 0;
					break;
				}
			}
			if (ready) {
				_loadQ.splice(i, 1);
				require(q.m, q.cb);
			}
		}
	}

	// Injects a script tag into the DOM
	function _inject (f, m, script, q, isReady, timeoutID) {
		
		_head = _head || document.getElementsByTagName('head')[0];

		script = document.createElement("script");
		script.async = true;
		script.src = f;

		/**
		* Bind to load events, we do it this way vs. addEventListener for IE support.
		* No reason to use addEventListener() then fallback to script.onload, just always use script.onload;
		*/
		script.onreadystatechange = script.onload = function () {

			isReady = !script.readyState || script.readyState === "complete" || script.readyState === "loaded";

			if (isReady) {
				
				clearTimeout(timeoutID);
				script.onload = script.onreadystatechange = script.onerror = null;

				if (_defineQ.length) {
					q = _defineQ.splice(0,1)[0];
					if (q) {
						q.splice(0,0, m); // set id to the module id before calling define()
						q.splice(q.length,0, true); // set alreadyQed to true, before calling define()
						define.apply(root, q);
					}
				}
			}
		};

		script.onerror = function (e) {
			
			clearTimeout(timeoutID);
			script.onload = script.onreadystatechange = script.onerror = null;

			throw new Error(f + " failed to load.");
		};

		// If the script hasn't finished loading after x number of seconds, error out.
		timeoutID = setTimeout(script.onerror, _waitSeconds * 1000);

		// Prepend the script to document.head
		_head.insertBefore(script, _head.firstChild);

		return 1;
	}

	// Does all the loading of modules and plugins.
	function _load (modules, callback, i, m, f) {

		_loadQ.push({m: modules, cb: callback});

		for (i = 0; i < modules.length; i ++) {
			m = modules[i].split("!");
			// It's normal module, not a plugin.
			if (!~m.indexOf("!")) {
				m = m[0];
				f = _getURL(m);
				// Inject the file into the DOM if the file has not been loaded yet and if the module is not yet defined.
				_loadedFiles[f] = (!_module(m) && !_loadedFiles[f]) ? _inject(f, m) : 1;
			}

			else{
				_loadPluginModule(m);
			}
		}
	}

	function _loadPluginModule (module, plugin) {

		module = module.split("!");
		plugin = module.splice(0,1);
		module = module.join("!");

		// Let's make sure the plugin is loaded before we do anything else.
		require(plugin, function (pluginModule) {
			//console.log(plugin + " plugin loaded!", pluginModule);
		});
	}

	/*
	* Gets the module by `id`, otherwise if `def` is specified, define a new module.
	*/
	function _module (id, def, noExports, ns, i, l, parts, pi) {

		/**
		* Always return back the id for "require", "module" and "exports",
		* these are replaced by calls to _swapArgs
		*/
		if (id === "require" || id === "module" || id === "exports") {
			return id;
		}

		ns = _modules;
		parts = id.split("/");

		for (i = 0, l = parts.length; i < l; i ++) {
			pi = parts[i];
			if (!ns[pi] || (!ns[pi].exports && i === l-1)) {
				if (!def) {
					return 0;
				}
				ns[pi] = (i === l-1 && def) ? def : {};
			}
			ns = ns[pi];
		}

		return noExports ? ns : (ns.exports || ns);
	}

	// Gets the URL for a given moduleID.
	function _getURL (id) {
		id = _normalize(id);
		for(var p in _paths) {
			id = id.replace(new RegExp("(^" + p + ")", "g"), _paths[p]);
		}
		return _baseUrl + id + (id.indexOf(".") < 0 ? ".js" : "") + _urlArgs;
	}

	function _swapArgs (a, s, j) {
		for (var i in s) {
			j = a.indexOf(i);
			if (~j) {
				a[j] = s[i];
			}
		}
		return a;
	}

	/*
	* Stores dependencies for this module id.
	* Also checks for any circular dependencies, if found, it defines those modules as empty objects temporarily
	*/
	function _resolveCiruclarReferences (id, dependencies, circulars, i, j, d, subDeps, sd, cid) {
		
		_dependencies[id] = dependencies;
	
		/*
		* Check for any dependencies that have circular references back to this module
		*/
		for (i = 0; i < dependencies.length; i ++) {
			d = dependencies[i];
			subDeps = _dependencies[d];
			if (subDeps) {
				for (j = 0; j < subDeps.length; j ++) {
					sd = subDeps[j];
					if (dependencies.indexOf(sd) < 0) {
						if (sd !== id) {
							dependencies.push(sd);
						}
						else{
							// Circular reference detected. Define circular modules as empty modules to be defined later
							_module(d, {exports : {}});
						}
					}
				}
			}
		}
	}
	
	/**
	* Define modules. AMD-spec compliant.
	*/
	var define = function (id, dependencies, factory, alreadyQed, depsLoaded, module, facArgs, context, ri) {

		if (typeof id !== 'string') {
			factory = dependencies;
			dependencies = id;
			id = null;

			// No id means that this is an anonymous module, push it to the q, to be defined upon onLoad
			_defineQ.push([dependencies, factory]); 
			return;
		}

		if (!_isArray(dependencies)) {
			factory = dependencies;
			dependencies = [];
		}

		if (!alreadyQed) {
			_defineQ.push(null); // Add an empty queue here to be cleaned up by onLoad
		}

		context = _getContext(id);

		if (!dependencies.length && factory.length && typeof factory === "function") {

			// Check for CommonJS-style requires, and add them to the deps array
			factory.toString()
				.replace(/(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg, "") // Remove any comments first
				.replace(/(?:require)\(\s*["']([^'"\s]+)["']\s*\)/g, // Now let's check for any sync style require("module") calls

					function ($0, $1) {
						if (dependencies.indexOf($1) < 0) {
							dependencies.push($1);
						}
					}
				);

			dependencies = (factory.length > 1 ? ["require", "exports", "module"] : ["require"]).concat(dependencies);
		}

		if (dependencies.length && !depsLoaded) {

			_resolveCiruclarReferences(id, dependencies.slice(0));

			require(dependencies, function () {
				define(id, Array.prototype.slice.call(arguments, 0), factory, true, true);
			}, context);

			return;
		}

		module = _module(id, null, true);
		module = module || {exports: {}};

		module.id = id;
		module.url = _getURL(id);

		if (typeof factory === "function") {

			// Swap "require", "module" and "exports" with actual objects
			facArgs =_swapArgs(
				dependencies.length ? dependencies : (factory.length > 1 ? ["require", "exports", "module"] : ["require"]),
				{
					"require" : require.localize(context),
					"module" : module,
					"exports" : module.exports
				}
			);

			/*
			* In some scenarios, the global require object might have slipped through,
			* If so, replace it with a local require.
			*/
			ri = facArgs.indexOf(require);
			if (~ri) {
				facArgs[ri] = require.localize(context);
			}

			module.exports = factory.apply(factory, facArgs) || module.exports;
		}
		else{
			module.exports = factory;
		}
		// Define the module
		_module(id, module);

		/*
		* Clear the dependencies from the _dependencies object.
		* _dependencies gets checked regularly to resolve circular dependencies
		* and if this module had any circulars, they have already been resolved.
		*/
		delete _dependencies[id];
		_checkLoadQ();
	};

	// Our define() function is an AMD implementation
	define.amd = {};

	/**
	* Asynchronously loads in js files for the modules specified.
	* If all modules are already defined, the callback function is invoked immediately.
	* If id(s) is specified and no callback function, attempt to get the module and
	* return the module if it is defined, otherwise throw an Error.
	*/
	var require = function (ids, callback, context) {

		if (!callback) {
			callback = _module(_resolve(ids, context));
			if (!callback) {
				throw new Error(ids + " is not defined.");
			}
			return callback;
		}

		ids = (!_isArray(ids)) ? [ids] : ids;

		var i, id,
			moduleList = [],
			modules = [];

		for (i = 0; i < ids.length; i ++) {
			id = _resolve(ids[i], context);
			moduleList.push(id);
			modules.push(_module(id));
		}

		if (~modules.indexOf(0)) {
			_load(moduleList, callback);
			return;
		}

		// Call the callback, swapping "require" with the actual require function
		callback.apply(root, _swapArgs(modules, {"require" : require}));
	};

	require.config = function (obj) {
		obj = obj || {};

		_baseUrl = obj.baseUrl || _baseUrl;
		// Add a trailing slash to baseUrl if needed.
		_baseUrl += (_baseUrl && _baseUrl.charAt(_baseUrl.length-1) !== "/") ? "/" : ""; 

		_urlArgs = obj.urlArgs ? "?" + obj.urlArgs : _urlArgs;

		_waitSeconds = obj.waitSeconds || _waitSeconds;

		for (var p in obj.paths) {
			_paths[p] = obj.paths[p];
		}
	};

	require.toUrl = function (id, context) {
		return _getURL(_resolve(id, context));
	};

	require.localize = function (context) {

		function localRequire (ids, callback) {
			return require(ids, callback, context);
		}

		localRequire.toUrl = function (id) {
			return require.toUrl(id, context);
		};

		return localRequire;
	};

	// Define global define/require methods, unless they are already defined.
	root.define = root.define || define;
	root.require = root.require || require;

})(window || exports);

// If browser, use window, else assume we're in a CommonJS environment and use exports as the root