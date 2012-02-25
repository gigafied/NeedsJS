/*
 * needs.js v0.9.5
 * http://minion.org
 *
 * (c) 2012, Taka Kojima (taka@gigafied.com)
 * Licensed under the MIT License
 *
 * Date: Fri Feb 24 16:10:15 2012 -0800
 */
 (function () {

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
		_waitSeconds = 10, // Defaults to "10". Number of seconds before giving up on a file request

		// If window is defined set root to window, else assume CommonJS env
		_root = window || exports;

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
		
		for (i = _loadQ.length-1; i >= 0; i --) {

			ready = 1;
			q = _loadQ[i];

			if (q) {

				for (j = q.m.length-1; j >= 0; j --) {
					if (!_module(q.m[j])) {
						ready = 0;
						break;
					}
				}
				if (ready) {
					_loadQ.splice(i, 1);
					if (q.cb) {
						require(q.m, q.cb);
					}
				}
			}
		}
	}

	// Injects a script tag into the DOM
	function _inject (f, m, script, q, isReady, timeoutID) {
		
		if (!_head) {
			_head = document.head || document.getElementsByTagName('head')[0];
		}

		script = document.createElement("script");
		script.async = true;
		script.src = f;

		function cleanup () {
			clearTimeout(timeoutID);
			script.onload = script.onreadystatechange = script.onerror = null;
		}

		// Bind to load events
		script.onreadystatechange = script.onload = function () {

			isReady = !script.readyState || script.readyState === "complete" || script.readyState === "loaded";

			if (isReady) {
				cleanup();
				if (_defineQ.length) {
					q = _defineQ.splice(0,1)[0];
					if (q) {
						q.splice(0,0, m); // set id to the module id before calling define()
						q.splice(q.length,0, true); // set alreadyQed to true, before calling define()
						define.apply(_root, q);
					}
				}
			}
		};

		script.onerror = function (e) {
			cleanup();
			throw new Error(f + " failed to load.");
		};

		// If the script hasn't finished loading after x number of seconds, error out.
		timeoutID = setTimeout(script.onerror, _waitSeconds * 1000);

		// Prepend the script to document.head
		_head.insertBefore(script, _head.firstChild);

		return 1;
	}

	// Does all the loading of JS files
	function _load (q, i, f) {

		_loadQ.push(q);

		for (i = 0; i < q.f.length; i ++) {
			f = q.f[i];
			// Inject the file into the DOM if it has not been loaded yet and if f is truthy.
			_loadedFiles[f] = (f && !_loadedFiles[f]) ? _inject(f, q.m[i]) : 1;
		}
	}

	/*
	* Gets the module by `id`, otherwise if `def` is specified, define a new module.
	*/
	function _module (id, def, noExports, ns, i, l, parts, pi) {

		/* Always return back the id for "require", "module" and "exports",
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
					return false;
				}
				ns[pi] = (i === l-1 && def) ? def : {};
			}
			ns = ns[pi];
		}

		return noExports ? ns : (ns.exports || ns);
	}

	// Gets the URL for a given moduleID.
	function _getURL (id) {		
		for(var p in _paths) {
			id = id.replace(new RegExp("(^" + p + ")", "g"), _paths[p]);
		}
		return _baseUrl + _normalize(id) + (id.indexOf(".") < 0 ? ".js" : "") + _urlArgs;
	}

	function _swapArgs (a, s, j) {
		for (var i in s) {
			j = a.indexOf(i);
			if (j > -1) {
				a[j] = s[i];
			}
		}
		return a;
	}

	/*
	* Gets all dependencies that have circular references back to this module
	*/
	function _getCircularDependencies (id, deps, circularDeps, i, j, d, subDeps, sd) {

		deps = _dependencies[id] || [];
		circularDeps = [];

		for (i = 0; i < deps.length; i ++) {
			d = deps[i];
			subDeps = _dependencies[d];
			if (subDeps) {
				for (j = 0; j < subDeps.length; j ++) {
					sd = subDeps[j];
					if (sd != id && deps.indexOf(sd) < 0) {
						deps.push(sd);
					}
					else if(sd === id){
						circularDeps.push(d);
					}
				}
			}
		}
		return circularDeps;
	}

	/*
	* Stores dependencies for this module id.
	* Also checks for any circular dependencies, if found, it defines those modules as empty objects temporarily
	*/
	function _setDependencies (id, dependencies, circulars, i, cid) {
		
		_dependencies[id] = dependencies.slice(0);
		circulars = _getCircularDependencies(id);

		// Define circular modules as empty modules to be defined later
		for(i = 0; i < circulars.length; i ++) {
			cid = circulars[i];
			_module(cid, {
				id: 0,
				url: 0,
				exports : {}
			});
		}
	}
	
	/**
	* Define modules. AMD-spec compliant.
	*/
	var define = function (id, dependencies, factory, alreadyQed, depsLoaded, module, facArgs, context) {

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

			_setDependencies(id, dependencies);

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
			var ri = facArgs.indexOf(require);
			if (ri > -1) {
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
			if (typeof ids === "object" && !_isArray(ids)) {
				return require.config(ids);
			}
			callback = _module(_resolve(ids, context));
			if (!callback) {
				throw new Error(ids + " is not defined.");
			}
			return callback;
		}

		ids = (!_isArray(ids)) ? [ids] : ids;

		var i, id, module,
			fileList = [],
			moduleList = [],
			modules = [];

		for (i = 0; i < ids.length; i ++) {
			id = _resolve(ids[i], context);
			module = _module(id);
			moduleList.push(id);
			if (module) {
				modules.push(module);
				fileList.push(0);
			}
			else{
				fileList.push(_getURL(id));
			}
		}

		if (fileList.length > modules.length) {
			_load({
				f: fileList,
				m: moduleList,
				cb : callback
			});
			return;
		}

		// Call the callback, swapping "require" with the actual require function
		callback.apply(_root, _swapArgs(modules, {"require" : require}));
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
	_root.define = _root.define || define;
	_root.require = _root.require || require;

})();
