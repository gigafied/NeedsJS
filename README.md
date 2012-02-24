## Needs.JS - A lean and mean AMD loader

Needs.JS is only 1.8kb minified and gzipped, it works just like your other favorite AMD loader.

Needs.JS is very fast, downloading all modules asynchronously (including anonymous modules), and executing them as soon as possible. Nothing is deferred in Needs. This means zero use of `eval` and zero use of `setTimeout`. 

Needs.JS supports all current AMD features, with the exception of plugins and the CommonJS module format, which are coming soon.

####Using Needs.JS

    require.configure({
		    rootPath: "/root/path", // Like RequireJS' baseUrl
		    paths: {
		        "some": "some/v1.0" // OPTIONAL. Same as RequireJS implementation
		    },
		    fileSuffix: (+ new Date()) // OPTIONAL. Useful for disabling caching of JS files during dev
		});


The above is pretty much the only difference to whatever AMD loader you are currently using and Needs.JS.

Grab the src from `dist/needs-latest-min.js` and include it in place of your current AMD loader, and you're all set!

For more info on AMD in general, usage and formats you can refer to the docs at [RequireJS](http://requirejs.org/docs/start.html)

You can grab and run the unit tests for Needs.JS [here](https://github.com/gigafied/amdjs-tests) 

#### Supported Browsers:

- IE 7+
- FireFox 3.6+
- Chrome
- Safari
- Opera
- 

#### Coming Soon:

- Plugin support
- CommonJS module pattern support
- Build tool