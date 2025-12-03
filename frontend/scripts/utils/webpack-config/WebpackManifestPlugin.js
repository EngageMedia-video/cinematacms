/**
 * Simple Webpack plugin to generate a manifest.json file that maps
 * original filenames to their content-hashed versions.
 *
 * This allows Django templates to reference files by their original names
 * (e.g., "js/index.js") and look up the actual hashed filename
 * (e.g., "js/index-75dac8d2.js") at runtime.
 *
 * @param {Object} options - Plugin options
 * @param {number} [options.hashLength] - Expected hash length (e.g., 8 for [contenthash:8])
 *                                        If not provided, matches any hex hash length
 */
const { Compilation } = require('webpack');
const { RawSource } = require('webpack-sources');

class WebpackManifestPlugin {
	constructor(options = {}) {
		this.options = options;
		// Build regex pattern for matching content hashes
		// If hashLength specified, match exactly that many hex chars
		// Otherwise, match one or more hex chars (flexible)
		const hashPattern = options.hashLength
			? `[a-f0-9]{${options.hashLength}}`
			: '[a-f0-9]+';
		// Match: -[hash]. (dash, hex chars, literal dot)
		// Case-insensitive to handle uppercase hashes
		this.hashRegex = new RegExp(`-${hashPattern}\\.`, 'i');
	}

	apply(compiler) {
		compiler.hooks.thisCompilation.tap('WebpackManifestPlugin', (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: 'WebpackManifestPlugin',
					stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
				},
				() => {
					// Build the manifest object
					const manifest = {};

					// Iterate over all compiled assets
					for (const filename of Object.keys(compilation.assets)) {
						// Skip non-JS/CSS files
						if (!filename.match(/\.(js|css)$/)) {
							continue;
						}

						// Extract the original name by removing the content hash
						// Format: name-[hash].ext -> name.ext
						const originalName = filename.replace(this.hashRegex, '.');

						// Only add if the filename was actually hashed
						if (originalName !== filename) {
							// Clean up paths for Django's {% static %} tag
							// Remove leading ./ and static/ prefix
							const cleanOriginal = originalName.replace(/^\.\/static\//, '');
							const cleanHashed = filename.replace(/^\.\/static\//, '');
							manifest[cleanOriginal] = cleanHashed;
						}
					}

					// Convert manifest to JSON
					const manifestJson = JSON.stringify(manifest, null, 2);

					// Add the manifest.json file to webpack's output using Webpack 5 API
					compilation.emitAsset(
						'static/manifest.json',
						new RawSource(manifestJson)
					);
				}
			);
		});
	}
}

module.exports = WebpackManifestPlugin;
