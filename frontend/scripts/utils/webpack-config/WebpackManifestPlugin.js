/**
 * Simple Webpack plugin to generate a manifest.json file that maps
 * original filenames to their content-hashed versions.
 *
 * This allows Django templates to reference files by their original names
 * (e.g., "js/index.js") and look up the actual hashed filename
 * (e.g., "js/index-75dac8d2.js") at runtime.
 */
const { Compilation } = require('webpack');
const { RawSource } = require('webpack-sources');

class WebpackManifestPlugin {
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
						const originalName = filename.replace(/-[a-f0-9]{8}\./, '.');

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
