/*
 * needs.js v0.0.1
 * http://minion.org
 *
 * (c) 2012, Taka Kojima (taka@gigafied.com)
 * Licensed under the MIT License
 *
 * Date: Wed Feb 22 04:12:33 2012 -0800
 */
 (function (root) {

	"use strict";

	/*================= polyfills =================*/
		Array.prototype.indexOf = Array.prototype.indexOf || function (a, b, c, r) {
			for (b = this, c = b.length, r = -1; ~c; r = b[--c] === a ? c : r);
			return r;
		};
	/*================= END OF polyfills =================*/
	
	/*================= internal variables =================*/

		var _moduleMappings = [],
			_isNode = (typeof window === "undefined"),
			_loadQ = [],
			_loadedFiles = [],
			_currentModule = null,
			_modules = {},
			// Configurable properties...
			_rootPath = "",
			_fileSuffix = "";

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

		function _dirname (path) {
			if (!path) {return path;}
			return path.substr(0, path.lastIndexOf("/"));
		}

		function _resolve (path, basePath) {
			basePath = basePath || _rootPath;
			return _normalize(basePath + "/" + path);
		}

		function _checkLoadQ (i, j, l, q, ready) {
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
					i --;
					if (q.cb) {
						q.cb.apply(root, _get(q.m));
						q.cb = null;
					}
				}
			}
		}

		// Injects a Script tag into the DOM
		function _inject (f, m, timeout, doc, injectObj, script) {

			timeout = timeout || 0;
			doc = document;

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

			script.onreadystatechange = script.onload = function (e) {

				function setCurrentModule () {
					_currentModule = {
						i: m, //id
						p: f // path
					};
				}
				script.onload = script.onreadystatechange = script.onerror = null;

				if(_currentModule) {setCurrentModule();}
				else{_zTimeout(setCurrentModule);}
			};

			script.onerror = function (e) {
				script.onload = script.onreadystatechange = script.onerror = null;
				throw new Error(f + " failed to load.");
			};

			script.src = f;
			
			// Append the script to the document head/body
			(doc.head || doc.body).appendChild(script);
		}

		// Does all the loading of JS files
		function _load (q, i) {

			_loadQ.push(q);

			for (i = 0; i < q.f.length; i ++) {
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
		}

		/*
			Used by needs.get() and needs.define().
			Gets the module by `id`, otherwise if `def` is specified, define a new module.
		*/
		function _module (id, def, ns, i, l, parts) {
			ns = _modules;

			if(!id){return false;}

			parts = id.split("/");

			for (i = 0, l = parts.length; i < l; i ++) {
				if (!ns[parts[i]]) {
					if (!def) {
						return false;
					}
					ns[parts[i]] = i === l-1 ? def : {};
				}
				ns = ns[parts[i]];
			}
			return ns;
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
			if (_moduleMappings[id]) {
				return _moduleMappings[id];
			}
			return id.indexOf("*") > -1 ? id.replace("/*", "") : id + ".js" + _fileSuffix;
		};


		/**
			Tells us that filePath provides the class definitions for these modules.
			Useful in cases where you group definitions into minified js files.
		*/
		var _provides = function (file, definitions, i) {

			definitions = _strToArray(definitions);

			for (i = definitions.length - 1; i >= 0; i --) {
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

		function doDefine (moduleID, modulePath, o) {

			if(!id && !_currentModule) {
				_zTimeout(doDefine);
				return;
			}

			moduleID = _currentModule ? _currentModule.i : null;
			modulePath = _currentModule ? _currentModule.p : null;

			_currentModule = null;

			dependencies = dependencies || [];

			id = id || moduleID;
			
			if (dependencies.length > 0) {
				require(dependencies, function () {
					define(id, exports, null, arguments);
				}, modulePath);
				return;
			}

			if (_isFunction(exports)) {
				exports = exports.apply(exports, args[3] || []);
			}

			_module(id, exports);
			_checkLoadQ();
		}
	};

	/**
		Asynchronously loads in js files for the modules specified.
		If the modules have already been loaded, or are already defined,
		the callback function is invoked immediately.
	*/
	var require = function (ids, callback, modulePath) {

		ids = _strToArray(ids);
	
		var fileList = [],
			moduleList = [],
			modules = [],
			ready = true,
			i,
			id,
			module,
			file,
			q;

		for (i = 0; i < ids.length; i ++) {
			id = _resolve(ids[i], _dirname(modulePath));
			module = _get(id);
			if (!module) {
				ready = false;
				file = _getURL(id);

				moduleList.push(id);
				fileList.push(file);
			}
			else{
				modules.push(module);
			}
		}

		if (!ready) {

			q = {
				f : fileList,
				m : moduleList,
				cb : callback
			};

			_load(q);
			return;
		}

		callback.apply(root, modules);
	};

	require.configure = function (configObj) {

		configObj = configObj || {};

		_rootPath = configObj.rootPath || _rootPath;
		_fileSuffix = configObj.fileSuffix ? "?" + configObj.fileSuffix : _fileSuffix;

		if (configObj.paths) {
			for (var p in configObj.paths) {
				_provides(p, configObj.paths[p]);
			}
		}
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
