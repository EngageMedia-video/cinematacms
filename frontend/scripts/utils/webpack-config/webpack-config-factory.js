const preparePages = require("../prepare-pages/prepare-pages.js");

const { configuration: defaultConfiguration } = require("./configuration.js");
const { webpackConfiguration } = require("./webpack.configuration.js");

const webpackConfigFactory = (env, inputConfig) => {
	const configuration = {
		...defaultConfiguration,
		...inputConfig,
	};

	if ("development" === env) {
		return {
			mode: "development",
			optimization: {
				minimize: false,
			},
			...webpackConfiguration(
				env,
				preparePages(configuration.pages, configuration.html, configuration.window),
				configuration
			),
		};
	}

	return {
		mode: "production",
		devtool: "testing" === env ? "source-map" : false,
		performance: {
			hints: "warning",
			maxEntrypointSize: 600000,
			maxAssetSize: 600000,
		},
		optimization: {
			minimize: "testing" !== env,
			runtimeChunk: false,
			splitChunks: {
				chunks: "all",
				automaticNameDelimiter: "-",
				maxInitialRequests: 5,
				cacheGroups: {
					vendors: {
						test: /[\\/]node_modules[\\/]/,
						name: "_commons",
						priority: 1,
						chunks: "initial",
					},
					videoJs: {
						test: /[\\/]node_modules[\\/]video\.js|video-js/,
						name: "video-js-chunk",
						priority: 10,
						chunks: "all",
					},
					styles: {
						name: "styles",
						test: /\.css$/,
						chunks: "all",
						enforce: true,
					},
					mediaComponents: {
						test: /[\\/]components[\\/]MediaViewer/,
						name: "media-components",
						priority: 5,
						chunks: "async",
						enforce: true,
					},
				},
			},
		},
		...webpackConfiguration(
			env,
			preparePages(configuration.pages, configuration.html, configuration.window),
			configuration
		),
	};
};

module.exports = webpackConfigFactory;
