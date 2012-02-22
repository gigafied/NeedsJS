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

		var _moduleMappings = [];
		var _initialized;
		var _loadQ = [];
		var _waitID;
		var _waitingForLoad = [];
		var _loadedFiles = [];
		var _waitInterval = 500;
		var _isNode = (typeof window === "undefined");
		var _currentModuleID = null;

	/*================= END OF internal variables =================*/


	/*================= HELPER FUNCTIONS =================*/

		var _isArray = function (a) {
			return a instanceof Array;
		};

		var _isObject = function (obj) {
			return typeof obj === "object";
		};

		var _isFunction = function (fn) {
			return typeof fn === "function";
		};

		var _strToArray = function (s) {
			return (!_isArray(s)) ? [s] : s;
		};

		var _zTimeout = function (fn) {
			return setTimeout(fn, 0);
		};

		var _setModuleID = function (id) {
			_currentModuleID = id;
		};

		var _getModuleID = function () {
			return _currentModuleID;
		};

		var _checkLoadQ = function () {
			var i, j, q, modules, modulesArray;
			q = {};
			modules = {};
			modulesArray = [];

			for (i = _loadQ.length - 1; i >= 0; i --) {

				q = _loadQ[i];
				
				for (var j = q.m.length-1; j >= 0; j --) {
					if (!_needs.get(q.m[j])) {
						_zTimeout(_checkLoadQ);
						return;
					}
				}

				if (q.cb) {
					q.cb.apply(root, _needs.get(q.m));
				}
				_loadQ.splice(i, 1);
			}
		};

		var _checkWaitQ = function () {

			var w = _waitingForLoad;
			var i, o;

			clearTimeout(_waitID);

			for (i = 0; i < w.length; i += 1) {
				o = w[i];
				o.e += 50;
				
				if (o.e >= _needs.errorTimeout) {
					o.s.onerror();
				}
			}

			if (w.length > 0) {
				_waitID = setTimeout(_checkWaitQ, _waitInterval);
			}
		};
		
		// Injects a Script tag into the DOM
		var _inject = function (f, m) {

			var doc = document;
			var body = "body";

			var injectObj, script;

			if (!doc[body]) {
				return _zTimeout(
					function () {
						_inject(f,m);
					}
				);
			}

			script = doc.createElement("script");
			script.async = true;
		
			injectObj = {
				f : f,		// File
				m : m,		// Module
				e : 0,		// Elapsed Time
				s : script	// Script
			};

			_waitingForLoad.push(injectObj);

			script.onreadystatechange = script.onload = function (e) {
				injectObj.s.onload = injectObj.s.onreadystatechange = null;
				injectObj.s.onerror = null;					
				_waitingForLoad.splice(_waitingForLoad.indexOf(injectObj), 1);
			};

			script.onerror = function (e) {
				injectObj.s.onload = injectObj.s.onreadystatechange = null;
				injectObj.s.onerror = null;					
				_waitingForLoad.splice(_waitingForLoad.indexOf(injectObj), 1);
				throw new Error(injectObj.m + " failed to load. Attempted to load from file: " + injectObj.f);
			};

			script.src = f;
			
			// Append the script to the document body
			doc[body].appendChild(script);
		};

		// Does all the loading of JS files
		var _load = function (q) {

			_loadQ.push(q);

			for (var i = 0; i < q.f.length; i += 1) {
				_isNode ? require(q.f[i]) : _inject(q.f[i], q.m[i]);
			}

			/*
				If the load times out, fire onerror after the time defined by errorTimeout
				(default is 20 seconds). Can be changed through `needs.errorTimeout = ms;`
			*/
			_waitID = setTimeout(_checkWaitQ, _waitInterval);
		};

		/*
			Used by needs.get() and needs.define(). 
			Get the namespace, or create it if it does not exist (autoCreate). 
			Also optionally creates Objects in the specified namespace.
		*/
		var _module = function (id, autoCreate, definitions) {
			id = id || "";
			definitions = definitions || false;

			var ns = _ns;
			var i;

			if (id && !_isObject(id) && !_isFunction(id)) {
				var parts = id.split(needs.separator);

				if (_aliases.indexOf(parts[0]) > -1) {
					ns = _needs;
					parts.splice(0,1);
				}

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
					ns[className] = definitions[module];
				}
			}

			return ns;
		};

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

		needs.separator = configObj.separator || needs.separator;
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
	_needs.define = function (id, dependencies, exports) {
		var args = Array.prototype.concat.call(arguments, []);

		// If only one argument is provided, it's the definition
		if (args.length == 1) {
			exports = args[0];
			id = null;
		}
		// If args[0] is an array, it's a list of dependencies
		else if (_isArray(args[0]) {
			id = null;
			dependencies = args[0];
			exports = args[1];
		}
		// Otherwise, id and exports were passed in with no dependencies
		else if (args.length == 2) {
			exports = args[1];
		}

		dependencies = dependencies || [];

		id = id || _needs.getModuleID();

		if (dependencies.length > 0) {
			return _needs.require(dependencies, function () {
				_needs.define(id, exports.apply(_needs, arguments));
			});
		}

		var idA = id.split(_needs.separator);
		var ns = idA.splice(0, idA.length-1).join(_needs.separator);
		id = idA[0];
		var obj = {};
		obj[id] = exports;

		return _module(ns, true, obj);
	};

	// Gets the object by it's fully qualified identifier.
	_needs.get = function (id) {
		if (!_isArray(id)) {
			return _module(id, false);
		}
		else{
			var modules = [];
			for (var i = 0; i < id.length; i ++) {
				modules.push(_needs.get(id[i]));
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
		var url = _needs.rootPath + id.replace(new RegExp('\\' + needs.separator, 'g'), '/') + (isDir ? "" : '.js') + ((_needs.fileSuffix) ? "?" + _needs.fileSuffix : "");

		return url;
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
	_needs.require = function (ids, callback) {

		if (!_initialized) {
			_needs.configure();
		}

		ids = _strToArray(ids);
	
		var fileList = [];
		var moduleList = [];

		for (var i = 0; i < ids.length; i ++) {

			var id = ids[i];
			var file = _needs.getURL(id);

			moduleList.push(id);
			
			if ((_loadedFiles.indexOf(file) < 0) && !_needs.get(id)) {
				fileList.push(file);				
				_loadedFiles.push(file);
			}
		}

		if (fileList.length > 0) {

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
		}

		else if (callback) {
			callback.apply(root, _needs.get(ids));
		}
	};

	// Export for node
	_isNode ? module.exports = _needs : "";

	root.define = _needs.define;
	root.require = _needs.require;

	return _needs;

})(this);