const path = require('path');
const ejs = require('ejs');
const terser = require('terser');
const htmlmin = require('html-minifier-terser');
const fs = require('fs');

/**
 * @typedef {Object} Options
 * @property {boolean} compileDebug
 * @property {boolean} minimize
 * @property {boolean} beautify
 * @property {boolean} htmlmin
 * @property {import('html-minifier-terser').Options} htmlminOptions
 * @property {import('terser').MinifyOptions} terserOptions
 * @property {boolean} client
 * @property {string} delimiter
 * @property {string} openDelimiter
 * @property {string} closeDelimiter
 */

/**
 * Escape a string for use in a regular expression
 * @param {string} str String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Process includes in source templates by inlining them
 * @param {string} source Source template
 * @param {string} dir Template directory
 * @param {Object} options EJS options
 * @param {import('webpack').LoaderContext} context Webpack loader context
 * @returns {string} Processed source
 */
function processIncludes(source, dir, options, context) {
  // Create the regex pattern based on the delimiters
  const od = escapeRegExp(options.openDelimiter || '<');
  const cd = escapeRegExp(options.closeDelimiter || '>');
  const d = escapeRegExp(options.delimiter || '%');

  const includeRegex = new RegExp(
    `${od}${d}[-_]?\\s*include\\s*\\(\\s*['\"]([^'\"]+)['\"](?:\\s*,\\s*([^)]*))?\\s*\\)\\s*${d}${cd}`,
    'g'
  );

  const visited = new Set();
  const fileCache = new Map(); // Cache for file contents

  function processTemplate(template, currentDir, depth = 0) {
    if (depth > 100) return template; // Prevent infinite recursion

    let result = template;
    const matches = [];
    let match;

    // First collect all matches
    while ((match = includeRegex.exec(result)) !== null) {
      matches.push({
        fullMatch: match[0],
        includePath: match[1],
        position: match.index
      });
    }

    // Then process them in reverse order (to avoid position shifts)
    for (let i = matches.length - 1; i >= 0; i--) {
      const { fullMatch, includePath } = matches[i];
      let fullPath = includePath;

      // Resolve the path
      fullPath = path.resolve(currentDir, includePath);

      // Add extension if needed
      if (!path.extname(fullPath)) {
        fullPath += '.ejs';
      }

      // Mark as dependency
      if (context.addDependency) {
        context.addDependency(fullPath);
      }

      // Skip if already processed to avoid cycles
      if (visited.has(fullPath)) {
        continue;
      }

      visited.add(fullPath);

      // Read the include file if it exists
      if (fs.existsSync(fullPath)) {
        try {
          let includeContent;

          // Use cached content if available
          if (fileCache.has(fullPath)) {
            includeContent = fileCache.get(fullPath);
          } else {
            includeContent = fs.readFileSync(fullPath, 'utf8');
            fileCache.set(fullPath, includeContent);
          }

          const processedInclude = processTemplate(
            includeContent,
            path.dirname(fullPath),
            depth + 1
          );
          result = result.substring(0, matches[i].position) +
            processedInclude +
            result.substring(matches[i].position + fullMatch.length);
        } catch (err) {
          context.emitError(new Error(`Error processing include ${includePath}: ${err.message}`));
        }
      } else {
        context.emitWarning(new Error(`Include file not found: ${includePath}`));
      }
    }

    return result;
  }

  return processTemplate(source, dir);
}

/**
 * Fix EJS whitespace issues by normalizing spaces/newlines to match expected output
 * @param {string} source Source template
 * @returns {string} Template with fixed whitespace
 */
function fixWhitespace(source) {
  return source
    // Remove trailing whitespace on lines
    .replace(/[ \t]+$/gm, '')
    // Normalize multiple blank lines to a single one
    .replace(/\n{3,}/g, '\n\n')
    // Ensure consistent indentation after newlines
    .replace(/\n[ \t]*\n/g, '\n\n');
}

/**
 * @type {import('webpack').LoaderDefinitionFunction}
 * @this {import('webpack').LoaderContext}
 */
module.exports = function (source, sourceMaps, meta) {
  const callback = this.async();
  (async () => {
    this.cacheable && this.cacheable();
    const options = this.getOptions();
    /** @type {Options} */
    const defaults = {
      client: true,
      compileDebug: this.mode === 'development',
      minimize: this.mode === 'production',
      beautify: false,
      htmlmin: this.mode === 'production',
      htmlminOptions: {},
      terserOptions: {},
      delimiter: '%',
      openDelimiter: '<',
      closeDelimiter: '>'
    };
    const opts = { ...defaults, ...options };

    // minify html
    if (opts.htmlmin) {
      source = await htmlmin.minify(source, opts.htmlminOptions);
    }

    const templateDir = path.dirname(this.resourcePath);

    // Process includes
    source = processIncludes(source, templateDir, opts, this);

    // Fix common whitespace issues
    source = fixWhitespace(source);

    // Ensure newline at end
    if (!source.endsWith('\n')) {
      source += '\n';
    }

    // compile template
    const compileOpts = {
      ...opts,
      filename: path.relative(process.cwd(), this.resourcePath),
    };

    let template = ejs.compile(source, compileOpts).toString();

    // minify js with terser
    if (opts.minimize) {
      template = (await terser.minify(template, opts.terserOptions)).code ?? '';
    }

    callback(null, 'module.exports = ' + template, sourceMaps, meta);
  })().catch((err) => callback(err));
};
