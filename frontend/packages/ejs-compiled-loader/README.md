# ejs-compiled-loader for webpack

EJS loader for [webpack](http://webpack.github.io/). Uses [ejs](https://github.com/mde/ejs) function to compile templates.

To use [EJS by tj](https://github.com/tj/ejs) use 1.x branch and 1.x.x versions.

## Installation

`npm install ejs-compiled-loader`

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

``` javascript
var template = require("ejs-compiled-loader!./file.ejs");
// => returns the template function compiled with ejs templating engine.

// And then use it somewhere in your code
template(data) // Pass object with data

// Child Templates
// path is relative to where webpack is being run
<%- include templates/child -%>
```

## Options

Following options can be specified in query:

`beautify` — enable or disable terser beautify of template ast

`compileDebug` — see ejs compileDebug option

`htmlmin` — see [htmlminify section](#htmlminify)

`client` — (default: true) compile for client-side use. If set to false, the loader will compile templates for server-side rendering.

## Includes

This loader supports EJS includes in both client-side and server-side modes. In client-side mode, included templates must also be processed by the loader to be properly required at runtime.

Example of using includes:

```ejs
<!-- parent.ejs -->
<div class="parent">
  <%- include('./child') %>
</div>

<!-- child.ejs -->
<div class="child">
  <%= data %>
</div>
```

```javascript
// In your JS
const template = require('./parent.ejs');
const html = template({ data: 'Hello World' });
```

### Include Paths

When using includes, the paths are resolved as follows:

- Relative paths (starting with `./` or `../`) are resolved relative to the current template file
- Absolute paths are resolved from the project root
- Other paths are resolved as module imports

## htmlminify

```javascript
module: {
  rules: [{
    test: /\.ejs$/,
    use: {
      loader: 'ejs-compiled-loader',
      options: {
        htmlmin: true,
        htmlminOptions: {
          removeComments: true
        }
      }
    }
  }]
}
```

See [all options reference](https://github.com/kangax/html-minifier#options-quick-reference)

## License

MIT (http://www.opensource.org/licenses/mit-license.php)



