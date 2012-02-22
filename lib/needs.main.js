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

		function _isString (s) {
			return typeof s === "string";
		}

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
			return path.substr(path.lastIndexOf(_needs.separator)+1);
		}

		function _dirname (path) {
			if (!path) {return path;}
			return path.substr(0, path.lastIndexOf(_needs.separator));
		}

		function _resolve (path, basePath) {
			basePath = basePath || _needs.rootPath;
			return _normalize([basePath, path].join("/"));
		}

		function _checkLoadQ () {
			var i, j, l, q, ready;
			q = {};

			for (i = 0, l = _loadQ.length; i < l; i ++) {

				ready = true;

				q = _loadQ[i];


				for (j = q.m.length-1; j >= 0; j --) {

					if (!_needs.get(q.m[j])) {
						ready = false;
						break;
					}
				}

				if (ready) {
					_loadQ.splice(i, 1);
					l --;
					if (q.cb) {
						q.cb.apply(root, _needs.get(q.m));
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
				
				if (o.e >= _needs.errorTimeout) {
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
			var body = "body";

			var injectObj, script;

			if (!doc[body] || timeout) {
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

			script.onreadystatechange = script.onload = function (e) {

				function setCurrentModule () {
					_currentModule = {
						path: injectObj.f,
						id: injectObj.m	
					};
				}

				injectObj.s.onload = injectObj.s.onreadystatechange = null;
				injectObj.s.onerror = null;					
				_waitQ.splice(_waitQ.indexOf(injectObj), 1);

				if(_currentModule) {setCurrentModule();}
				else{_zTimeout(setCurrentModule);}
			};

			script.onerror = function (e) {
				injectObj.s.onload = injectObj.s.onreadystatechange = null;
				injectObj.s.onerror = null;					
				_waitQ.splice(_waitQ.indexOf(injectObj), 1);
				throw new Error(injectObj.m + " failed to load. Attempted to load from file: " + injectObj.f);
			};

			script.src = f;
			
			// Append the script to the document body
			doc[body].appendChild(script);
		}

		// Does all the loading of JS files
		function _load (q) {

			_loadQ.push(q);

			for (var i = 0; i < q.f.length; i += 1) {
				if(_isNode) {
					require(q.f[i]);
					_currentModule = {
						path: q.f[i],
						id: q.m[i]
					};
				}
				else{
					if (_loadedFiles.indexOf(q.f[i]) < 0) {
						_loadedFiles.push(q.f[i]);
						_inject(q.f[i], q.m[i], (i+1) * 5);
					}
				}
			}

			/*
				If the load times out, fire onerror after the time defined by errorTimeout
				(default is 20 seconds). Can be changed through `needs.errorTimeout = ms;`
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
				var parts = id.split(_needs.separator);

				for (i = 0; i < parts.length; i += 1) {
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

	/*================= END OF HELPER FUNCTIONS =================*/

	var _needs = {};	

	_needs.errorTimeout = 2e4;

	_needs.rootPath = "";
	_needs.fileSuffix = "";
	_needs.separator = "/";

	_needs.configure = function (configObj) {
		
		configObj = configObj || {};

		_needs.rootPath = configObj.rootPath || _needs.rootPath;
		_needs.rootPath = (_needs.rootPath.lastIndexOf("/") === _needs.rootPath.length - 1) ? _needs.rootPath : _needs.rootPath + "/";

		_needs.separator = configObj.separator || _needs.separator;
		_needs.fileSuffix = configObj.fileSuffix || _needs.fileSuffix;

		if (configObj.paths) {
			for (var i = 0; i < configObj.paths.length; i ++) {
				var m = configObj.paths[i];
				_needs.provides(m.file, m.modules);
			}
		}

		_initialized = true;
	};

	
	// Defines Classes under the given namespace (id).
	_needs.define = function () {

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

			var moduleID = _currentModule ? _currentModule.id : null;
			var modulePath = _currentModule ? _currentModule.path : null;

			_currentModule = null;

			dependencies = dependencies || [];

			id = id || moduleID;
			
			if (dependencies.length > 0) {
				_needs.require(dependencies, function () {
					_needs.define(id, exports, null, Array.prototype.slice.call(arguments, 0));
				}, modulePath);
				return;
			}

			if (_isFunction(exports)) {
				exports = exports.apply(exports, args[3] || []);
			}
			//console.log(id, exports);

			var o = {}; o[_basename(id)] = exports;
			_module(_dirname(id), true, o);
			_checkLoadQ();
		}
	};

	// Gets the object by it's fully qualified identifier.
	_needs.get = function (id) {
		if (!_isArray(id)) {
			return _module(id, false);
		}
		else{
			var modules = [];
			for (var i = 0; i < id.length; i ++) {
				modules[i] = _needs.get(id[i]);
			}
			return modules;
		}
	};

	// Gets the URL for a given moduleID.
	_needs.getURL = function (id) {

		if (_moduleMappings[id]) {
			return _moduleMappings[id];
		}

		var isDir = id.indexOf("*") > -1;
		id = isDir ? id.replace(".*", "") : id;
		return id + (isDir ? "" : '.js') + ((_needs.fileSuffix) ? "?" + _needs.fileSuffix : "");
	};


	/**
		Tells us that filePath provides the class definitions for these modules.
		Useful in cases where you group definitions into minified js files.
	*/
	_needs.provides = function (file, definitions) {

		definitions = _strToArray(definitions);

		for (var i = 0; i < definitions.length; i += 1) {
			_moduleMappings[definitions[i]] = file;
		}
	};

	/**
		Asynchronously loads in js files for the modules specified.
		If the modules have already been loaded, or are already defined,
		the callback function is invoked immediately.
	*/
	_needs.require = function (ids, callback, modulePath) {
		if (!_initialized) {
			_needs.configure();
		}

		ids = _strToArray(ids);
	
		var fileList = [];
		var moduleList = [];
		var modules = [];
		var ready = true;

		for (var i = 0; i < ids.length; i ++) {
			var id = _resolve(ids[i], _dirname(modulePath));
			var module = _needs.get(id);
			if (!module) {
				ready = false;
				var file = _needs.getURL(id);

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

	// Export for node
	if(_isNode) {
		module.exports = _needs;
	}

	root.define = _needs.define;
	root.require = _needs.require;
	root.needs = _needs;

	return _needs;

})(this);