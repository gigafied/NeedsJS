(function (root) {

	"use strict";

	/*================= polyfills =================*/

		if (!Array.prototype.indexOf) {
			Array.prototype.indexOf = function (a, b) {
				if (!this.length || !(this instanceof Array) || arguments.length < 1) {
					return -1;
				}

				b = b || 0;

				if (b >= this.length) {
					return -1;
				}

				while (b < this.length) {
					if (this[b] === a) {
						return b;
					}
					b ++;
				}
				return -1;
			};
		}
	/*================= END OF polyfills =================*/
	
	/*================= internal variables =================*/

		var _initialized;
		var _moduleMappings = [];
		var _isNode = (typeof window === "undefined");

		var _loadQ = [];
		var _loadedFiles = [];

		var _waitQ = [];
		var _waitInterval = 500;

		var _currentModule = null;

		var _ns = {};

	/*================= END OF internal variables =================*/


	/*================= HELPER FUNCTIONS =================*/


		function _isArray (a) {
			return a instanceof Array;
		}

		function _isObject (obj) {
			return typeof obj === "object";
		}

		function _isFunction (fn) {
			return typeof fn === "function";
		}

		function _strToArray (s) {
			return (!_isArray(s)) ? [s] : s;
		}

		function _zTimeout (fn) {
			return setTimeout(fn, 0);
		}

		function _normalize (path) {

			// Replace any references to ./ with ""
			path = path.replace(/(?:^|[^\.])(\.\/)/g, "/");

			// Replace any references to some/path/../ with "some/"
			var prevPath = "";
			while (prevPath !== path) {
				prevPath = path;
				path = path.replace(/([\w,\-]*[\/]{1,})([\.]{2,}\/)/g, "/");
			}

			// Replace any references to "//" or "////" with a single "/"
			path = path.replace(/(\/{2,})/g, "/");
			return path;
		}

		function _basename (path) {
			return path.substr(path.lastIndexOf("/")+1);
		}

		function _dirname (path) {
			if (!path) {return path;}
			return path.substr(0, path.lastIndexOf("/"));
		}

		function _resolve (path, basePath) {
			basePath = basePath || require.rootPath;
			return _normalize(basePath + "/" + path);
		}

		function _checkLoadQ () {
			var i, j, l, q, ready;
			q = {};

			for (i = 0; i < _loadQ.length; i ++) {

				ready = true;

				q = _loadQ[i];

				for (j = q.m.length-1; j >= 0; j --) {

					if (!_get(q.m[j])) {
						ready = false;
						break;
					}
				}

				if (ready) {
					_loadQ.splice(i, 1);
					if (q.cb) {
						q.cb.apply(root, _get(q.m));
						q.cb = null;
					}
				}
			}
		}

		function _checkWaitQ () {

			var w = _waitQ;
			var i, o;

			for (i = 0; i < w.length; i ++) {
				o = w[i];
				o.e += _waitInterval;
				
				if (o.e >= require.errorTimeout) {
					o.s.onerror();
				}
			}

			if (w.length > 0) {
				setTimeout(_checkWaitQ, _waitInterval);
			}
		}
		
		// Injects a Script tag into the DOM
		function _inject (f, m, timeout) {

			timeout = timeout || 0;

			var doc = document;

			var injectObj, script;

			if (!doc.body || timeout) {
				setTimeout(
					function () {
						_inject(f,m);
					}, timeout
				);
				return;
			}

			script = doc.createElement("script");
			script.async = true;
		
			injectObj = {
				f : f,		// File
				m : m,		// Module
				e : 0,		// Elapsed Time
				s : script	// Script
			};

			_waitQ.push(injectObj);

			function cleanup () {
				script.onload = script.onreadystatechange = null;
				script.onerror = null;					
				_waitQ.splice(_waitQ.indexOf(injectObj), 1);
			}

			script.onreadystatechange = script.onload = function (e) {

				function setCurrentModule () {
					_currentModule = {
						i: m, //id
						p: f // path
					};
				}

				cleanup();

				if(_currentModule) {setCurrentModule();}
				else{_zTimeout(setCurrentModule);}
			};

			script.onerror = function (e) {
				cleanup();
				throw new Error(m + " failed to load. Attempted to load from file: " + f);
			};

			script.src = f;
			
			// Append the script to the document head/body
			(doc.head || doc.body).appendChild(script);
		}

		// Does all the loading of JS files
		function _load (q) {

			_loadQ.push(q);

			for (var i = 0; i < q.f.length; i ++) {
				if(_isNode) {
					_currentModule = {
						p: q.f[i],
						i: q.m[i]
					};
					require(q.f[i]);
				}
				else{
					if (_loadedFiles.indexOf(q.f[i]) < 0) {
						_loadedFiles.push(q.f[i]);
						/*
							We need to stagger the injections at 5 ms intervals,
							If we don't the callbacks get invoked haphazardly. I.e. load moduleA, moduleB, moduleC without any delays
							moduleA, moduleB, moduleC all finish loading around the same time.
							moduleA executes first but moduleC gets the onLoad callback executed first...
							What!? Makes no sense, I know... nothing I can do about it besides staggering though. 

							It was either this or...shudder...eval.
					
						*/
						_inject(q.f[i], q.m[i], (i+1) * 5);
					}
				}
			}

			/*
				If the load times out, fire onerror after the time defined by errorTimeout
				(default is 20 seconds). Can be changed through `require.errorTimeout = ms;`
			*/
			setTimeout(_checkWaitQ, _waitInterval);
		}

		/*
			Used by needs.get() and needs.define(). 
			Get the namespace, or create it if it does not exist (autoCreate). 
			Also optionally creates Objects in the specified namespace.
		*/
		function _module (id, autoCreate, definitions) {
			id = id || "";
			definitions = definitions || false;

			var ns = _ns;
			var i;

			if (id && !_isObject(id) && !_isFunction(id)) {
				var parts = id.split("/");

				for (i = 0; i < parts.length; i ++) {
					if (!ns[parts[i]]) {
						if (autoCreate) {
							ns[parts[i]] = {};
						}
						else{
							return false;
						}
					}
					ns = ns[parts[i]];
				}
			}

			else if (id !== "") {
				ns = id;
			}
			else{
				return false;
			}

			if (definitions) {
			
				for (var module in definitions) {
					ns[module] = definitions[module];
				}
			}

			return ns;
		}

		// Gets the object by it's fully qualified identifier.
		var _get = function (id) {
			if (!_isArray(id)) {
				return _module(id, false);
			}
			var modules = [];
			for (var i = 0; i < id.length; i ++) {
				modules[i] = _get(id[i]);
			}
			return modules;
		};

		// Gets the URL for a given moduleID.
		var _getURL = function (id) {
			if (_moduleMappings[id]) {
				return _moduleMappings[id];
			}
			return id.indexOf("*") > -1 ? id.replace("/*", "") : id + ".js" + require.fileSuffix;
		};


		/**
			Tells us that filePath provides the class definitions for these modules.
			Useful in cases where you group definitions into minified js files.
		*/
		var _provides = function (file, definitions) {

			definitions = _strToArray(definitions);

			for (var i = 0; i < definitions.length; i ++) {
				_moduleMappings[definitions[i]] = file;
			}
		};		

	/*================= END OF HELPER FUNCTIONS =================*/
	
	// Defines Classes under the given namespace (id).
	var define = function () {

		var id, dependencies, exports;

		// Wrap this in a setTimeout(fn, 0) call so that _currentModule is already set by the load callback function
		var args = Array.prototype.slice.call(arguments, 0);

		// If only one argument is provided, it's the definition
		if (args.length === 1) {
			exports = args[0];
		}
		// Otherwise, if two arguments were passed in, id and exports were passed in with no dependencies
		else if (args.length === 2 || args[2] === null) {
			exports = args[1];

			// If args[0] is an array, it's a list of dependencies
			if (_isArray(args[0])) {
				dependencies = args[0];
			}
			// Otherwise, args[0] is the identifier and args[1] is the exports object
			else{
				id = args[0];
				exports = args[1];
			}
		}
		else if (args.length === 3) {
			id = args[0];
			dependencies = args[1];
			exports = args[2];
		}
		else{
			throw new Error("Invalid call to define(), expected 3 arguments, got " + args.length);
		}

		doDefine();

		function doDefine () {

			if(!id && !_currentModule) {
				_zTimeout(doDefine);
				return;
			}

			var moduleID = _currentModule ? _currentModule.i : null;
			var modulePath = _currentModule ? _currentModule.p : null;

			_currentModule = null;

			dependencies = dependencies || [];

			id = id || moduleID;
			
			if (dependencies.length > 0) {
				require(dependencies, function () {
					define(id, exports, null, Array.prototype.slice.call(arguments, 0));
				}, modulePath);
				return;
			}

			if (_isFunction(exports)) {
				exports = exports.apply(exports, args[3] || []);
			}

			var o = {}; o[_basename(id)] = exports;
			_module(_dirname(id), true, o);
			_checkLoadQ();
		}
	};

	/**
		Asynchronously loads in js files for the modules specified.
		If the modules have already been loaded, or are already defined,
		the callback function is invoked immediately.
	*/
	var require = function (ids, callback, modulePath) {
		if (!_initialized) {
			require.configure();
		}

		ids = _strToArray(ids);
	
		var fileList = [];
		var moduleList = [];
		var modules = [];
		var ready = true;

		for (var i = 0; i < ids.length; i ++) {
			var id = _resolve(ids[i], _dirname(modulePath));
			var module = _get(id);
			if (!module) {
				ready = false;
				var file = _getURL(id);

				moduleList.push(id);
				fileList.push(file);
			}
			else{
				modules.push(module);
			}
		}

		if (!ready) {

			var q = {
				f	: fileList,
				m	: moduleList,
				cb : callback
			};

			_zTimeout(
				function () {
					_load(q);
				}
			);

			return;
		}

		callback.apply(root, modules);
	};

	require.errorTimeout = 1e4;
	require.rootPath = "";
	require.fileSuffix = "";

	require.configure = function (configObj) {

		configObj = configObj || {};

		require.rootPath = configObj.rootPath || require.rootPath;
		require.rootPath = (require.rootPath.lastIndexOf("/") === require.rootPath.length - 1) ? require.rootPath : require.rootPath + "/";

		require.fileSuffix = "?" + configObj.fileSuffix || require.fileSuffix;

		if (configObj.paths) {
			for (var i = 0; i < configObj.paths.length; i ++) {
				var m = configObj.paths[i];
				_provides(m.file, m.modules);
			}
		}

		_initialized = true;
	};

	// Export for node
	if(_isNode) {
		module.exports = {require: require, define: define};
	}

	if(root.require) {
		require.configure(root.require);
	}

	root.define = define;
	root.require = require;

})(this);