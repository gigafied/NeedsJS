### Needs.JS - A lean and mean AMD loader
_Licensed under the MIT License_

Needs.JS is only 1.8kb minified and gzipped, it works just like your other favorite AMD loader.

Needs.JS is very fast, downloading all modules asynchronously (including anonymous modules), and executing them as soon as possible. Nothing is deferred in Needs. This means zero use of `eval` and zero use of `setTimeout`. 

Needs.JS supports all current AMD features, with the exception of plugins, which are coming soon.

####Using Needs.JS

	require.configure({
		rootPath: "/root/path", // Like RequireJS' baseUrl
		paths: {
			"some": "some/v1.0" // Same as RequireJS
		},
		fileSuffix: (+ new Date()) // Useful for disabling caching of JS files during dev
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


#### Coming Soon:

- Plugin support
- Build tool

 
#### MIT License

	(c) 2012 Taka Kojima (the "Author").
	All Rights Reserved.

	Permission is hereby granted, free of charge, to any person
	obtaining a copy of this software and associated documentation
	files (the "Software"), to deal in the Software without
	restriction, including without limitation the rights to use,
	copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the
	Software is furnished to do so, subject to the following
	conditions:

	The above copyright notice and this permission notice shall be
	included in all copies or substantial portions of the Software.

	Distributions of all or part of the Software intended to be used
	by the recipients as they would use the unmodified Software,
	containing modifications that substantially alter, remove, or
	disable functionality of the Software, outside of the documented
	configuration mechanisms provided by the Software, shall be
	modified such that the Author's bug reporting email addresses and
	urls are either replaced with the contact information of the
	parties responsible for the changes, or removed entirely.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
	EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
	OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
	NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
	HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
	WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
	OTHER DEALINGS IN THE SOFTWARE.

	Except where noted, this license applies to any and all software
	programs and associated documentation files created by the
	Author, when distributed with the Software.