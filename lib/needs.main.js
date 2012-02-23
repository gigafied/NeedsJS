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
		_currentModuleID = null,

		// Configurable properties...
		_rootPath = "",
		_fileSuffix = "",
		_paths = {},

		// If this is node, set root to module.exports
		_root = (typeof window !== "undefined") ? window : module.exports;


	function _isArray (a) {
		return a instanceof Array;
	}

	function _strToArray (s) {
		return (!_isArray(s)) ? [s] : s;
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
		path = path.charAt(0) === "/" ? path.substr(1) : path;
		return path;
	}

	function _dirname (path) {
		if (!path) {return path;}
		return path.substr(0, path.lastIndexOf("/"));
	}

	function _resolve (path, basePath) {
		return _normalize((basePath || _rootPath) + "/" + path);
	}

	function _checkLoadQ (i, j, k, l, q, q2, ready) {
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
				i --;
				if (q.cb) {
					q.cb.apply(_root, _get(q.m));
				}
			}

			else if (i > 0) {
				// Check for circular dependencies in earlier queues...
				for(k = i; k >= 0; k --) {
					q2 = _loadQ[k];
					for (j = q2.m.length-1; j >= 0; j --) {
						// Circular dependency detected..
						if (q.m.indexOf(q2.m[j]) > -1) {
							// Let's set it to an empty object for now...
							_module(q2.m[j], {});
							_checkLoadQ();
							return;
						}
					}
				}
			}
		}
	}

	// Injects a script tag into the DOM
	function _inject (f, m, script, q) {
		
		if(!_head) {
			_head = document.head || document.getElementsByTagName('head')[0];
		}

		script = document.createElement("script");
		script.async = true;
		script.src = f;

		// Bind to load events
		script.onreadystatechange = script.onload = function () {
			script.onload = script.onreadystatechange = script.onerror = null;
			if (_defineQ.length > 0) {
				q = _defineQ.splice(_defineQ.length-1,1)[0];
				q.unshift(m);
				define.apply(_root, q);
			}
		};

		script.onerror = function (e) {
			script.onload = script.onreadystatechange = script.onerror = null;
			throw new Error(f + " failed to load.");
		};

		// Prepend the script to document.head
		_head.insertBefore(script, _head.firstChild);
	}

	// Does all the loading of JS files
	function _load (q, i, f, m) {

		_loadQ.push(q);

		for (i = 0; i < q.f.length; i ++) {
			f = q.f[i];
			m = q.m[i];
			if (f && !_loadedFiles[f]) {
				_loadedFiles[f] = 1;
				_inject(f, m);
			}
		}
		_checkLoadQ();
	}

	/*
		Used by _get() and define().
		Gets the module by `id`, otherwise if `def` is specified, define a new module.
	*/
	function _module (id, def, ns, i, l, parts, pi) {

		if (id === "require") {
			return require;
		}
		else if(id === "module") {
			return {
				id: _currentModuleID || "",
				url: _getURL(_currentModuleID),
				exports : {}
			};
		}
		else if(id === "exports") {
			return _module("module").exports;
		}

		ns = _modules;
		parts = id.split("/");

		for (i = 0, l = parts.length; i < l; i ++) {
			pi = parts[i];
			if (!ns[pi]) {
				if (!def) {
					return false;
				}
				ns[pi] = i === l-1 ? def : {};
			}
			ns = ns[pi];
		}
		return ns.exports || ns;
	}

	// Gets the object by it's fully qualified identifier.
	var _get = function (id, i) {
		if (!_isArray(id)) {
			return _module(id);
		}
		var modules = [];
		for (i = 0; i < id.length; i ++) {
			modules[i] = _get(id[i]);
		}
		return modules;
	};

	// Gets the URL for a given moduleID.
	var _getURL = function (id) {		
		if(!id) {return "";}
		id = id.indexOf("*") > -1 ? id.replace("/*", "") : id + ".js" + _fileSuffix;
		for(var p in _paths) {
			id = id.replace(new RegExp("(^" + p + ")", "g"), _paths[p]);
		}
		return id;
	};
	
	// Define a module
	var define = function () {

		var id, dependencies, exports, modulePath, module;

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
			throw new Error("Invalid call to define()");
		}

		if (!id) {
			_defineQ.push(args);
			return;
		}

		_currentModuleID = id;

		dependencies = dependencies || [];

		if (dependencies.length > 0) {
			require(dependencies, function () {
				define(id, exports, null, arguments);
			}, id);
			_currentModuleID = null;
			return;
		}

		if (typeof exports === "function") {
			module = _get("module");
			exports = exports.apply(
				exports, 
				args[3] ? args[3] : exports.length > 0 ? [require, module, module.exports] : []
			) || module;
		}

		_module(id, exports);
		_currentModuleID = null;
		_checkLoadQ();
	};

	// Let people know our define() function is an AMD implementation
	define.amd = {};

	/**
		Asynchronously loads in js files for the modules specified.
		If the modules have already been loaded, or are already defined,
		the callback function is invoked immediately.
	*/
	var require = function (ids, callback, modulePath) {

		if(!callback) {
			if (typeof ids === "object") {
				return require.configure(ids);
			}
			return _get(ids);
		}

		ids = _strToArray(ids);

		var i, id, module, file, q,
			fileList = [],
			moduleList = [],
			modules = [];

		for (i = 0; i < ids.length; i ++) {
			id = _resolve(ids[i], _dirname(modulePath));
			module = _get(id);
			if (module) {
				modules.push(module);
				fileList.push("");
			}
			else{
				file = _getURL(id);
				fileList.push(file);
			}
			moduleList.push(id);
		}

		if (fileList.length > modules.length) {
			_load({
				f: fileList,
				m: moduleList,
				cb : callback
			});
			return;
		}

		callback.apply(_root, modules);
	};

	require.configure = function (obj) {
		obj = obj || {};
		_rootPath = obj.rootPath || _rootPath;
		_fileSuffix = obj.fileSuffix ? "?" + obj.fileSuffix : _fileSuffix;
		for (var p in obj.paths) {
			_paths[p] = obj.paths[p];
		}
	};

	require.toUrl = function (s) {
		return _resolve(s, _currentModuleID);
	};

	if(_root.require) {
		require.config(_root.require);
	}

	require.modules = _modules;

	// Define global define/require methods, unless they are already defined.
	_root.define = _root.define || define;
	_root.require = _root.require || require;

})();