# NeedsJS
*A lean and mean AMD loader*

## Features:

- The smallest AMD loader. Less than 2kb! (minified and gzipped)
- Fully compliant with the latest AMD specification
- Plugin support. Works with most (if not all) RequireJS plugins.

## Supported Browsers:

- IE 6+
- FireFox 2+
- Chrome 1+
- Safari 3+
- Opera 9+

## Getting Started

`$ npm i needs-amd`

NeedsJS mirrors RequireJS in its API. The currently supported configuration options are:

- `baseUrl`
- `urlArgs`
- `paths`
- `waitSeconds`

You can also specify plugin-specific configuration options the same way you do so in RequireJS.

	require.config({
		baseUrl: "/root/path",
		paths: {
			"modules": "sub/path/modules"
		},
		urlArgs: (+ new Date()) // Useful for disabling caching of JS files during dev,

		somePlugin : {
			// Plugin specific config for `somePlugin` goes here.
		}
	});


Note that you have to explicitly call `require.config()`. unlike RequireJS, you can't set a global object named `require`.

For more info on AMD in general, usage and formats you can refer to the docs at [RequireJS](http://requirejs.org/docs/start.html)

## License

**The MIT License**

<sub><sup>

(c) 2012-2017 Taka Kojima (the "Author").
All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

</sup></sub>
