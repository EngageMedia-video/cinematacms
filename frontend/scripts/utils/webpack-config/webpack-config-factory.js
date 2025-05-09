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
		optimization: {
			minimize: "testing" !== env,
			runtimeChunk: false,
			splitChunks: {
				chunks: "all",
				automaticNameDelimiter: "-",
				cacheGroups: {
					vendors: {
						test: /[\\/]node_modules[\\/]/,
						name: "_commons",
						priority: 1,
						chunks: "initial",
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
