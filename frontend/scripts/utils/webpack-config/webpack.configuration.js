const path = require("path");

// Webpack plugins.
const { LimitChunkCountPlugin } = require("webpack").optimize;
const HtmlWebpackPlugin = require("html-webpack-plugin");
const VirtualModulesPlugin = require("webpack-virtual-modules");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssUrlRelativePlugin = require("css-url-relative-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");

const MyHtmlBeautifyWebpackPlugin = require("./MyHtmlBeautifyWebpackPlugin.js");

const webpackConfiguration = (env, pages, config) => {
	const srcDir = config.src;
	const buildDir = config.build + "/" + env;

	const jsbuild = "./static/js/";
	const cssbuild = "./static/css/";

	const entry = () => {
		const ret = {};

		for (const k in pages) {
			if ("development" === env || !pages[k].buildExclude) {
				ret[k] = path.resolve(srcDir + "/" + k + ".js");
			}
		}

		return ret;
	};

	const output = (chunkhash, hash) => {
		let filename = "[name].js";

		if (chunkhash) {
			if ("" === chunkhash.trim()) {
				throw Error("Invalid chunkhash argument value: " + chunkhash);
			}

			filename = "[name]-[chunkhash].js";
		} else if (hash) {
			if ("" === hash.trim()) {
				throw Error("Invalid hash argument value: " + hash);
			}

			filename = "[name]-[hash].js";
		}

		return {
			filename: `${"development" === env ? "" : jsbuild}${filename}`,
			path: "development" === env ? srcDir : buildDir,
			// publicPath: "",
		};
	};

	const plugins = () => {
		const ret = [
			new Dotenv(),
			new MyHtmlBeautifyWebpackPlugin(),
			new CssUrlRelativePlugin(),
		];

		if ("development" !== env) {
			ret.push(
				new CopyPlugin({
					patterns: [
						{
							from: path.resolve(srcDir, "static/css/_extra.css"),
							to: path.resolve(buildDir, "static/css/_extra.css"),
						},
						{
							from: path.resolve(srcDir, "static/favicons"),
							to: path.resolve(buildDir, "static/favicons"),
						},
						{
							from: path.resolve(srcDir, "static/images/icons"),
							to: path.resolve(buildDir, "static/images/icons"),
						},
						{
							from: path.resolve(srcDir, "static/images/logos"),
							to: path.resolve(buildDir, "static/images/logos"),
						},
						{
							from: path.resolve(srcDir, "static/images/*.{png,svg}"),
							to: path.join(buildDir, "static/images"),
							context: path.join(srcDir, "static/images"),
						},
						{
							from: path.resolve(srcDir, "static/lib"),
							to: path.resolve(buildDir, "static/lib"),
						},
					],
				})
			);
		}

		const virtualPages = {};

		for (const k in pages) {
			if ("development" === env || !pages[k].buildExclude) {
				const file = path.resolve(srcDir + "/" + k + ".js");

				virtualPages[file] =
					!!pages[k].staticPage || !pages[k].render ? "" : pages[k].render;

				ret.push(
					new HtmlWebpackPlugin({
						template: path.resolve(__dirname, "../../templates/index.ejs"),
						hash: false,
						chunks: [k],
						...pages[k],
					})
				);
			}
		}

		if (0 < Object.keys(virtualPages).length) {
			ret.push(new VirtualModulesPlugin(virtualPages));
		}

		ret.push(
			new MiniCssExtractPlugin({
				filename: cssbuild + "[name].css",
				ignoreOrder: true,
			})
		);

		if ("development" !== env) {
			ret.push(new LimitChunkCountPlugin({ maxChunks: 1 }));
			ret.push(new ProgressBarPlugin({ clear: false }));

			if ("production" === env) {
				ret.push(
					new CssMinimizerPlugin({
						minimizerOptions: {
							preset: ["default", { discardComments: { removeAll: true } }],
						},
					})
				);
			}
		}

		return ret;
	};

	const rules = () => {
		return [
			{
				test: /\.(jsx|js)?$/,
				use: {
					loader: "babel-loader",
					options: {
						presets: ["@babel/preset-react"],
					},
				},
			},
			{
				test: /\.ejs$/,
				use: {
					loader: "ejs-compiled-loader",
					options: {
						htmlmin: true,
					},
				},
			},
			{
				test: /\.(sa|sc|c)ss$/,
				use: [
					{ loader: MiniCssExtractPlugin.loader },
					{ loader: "css-loader", options: { importLoaders: 1 } },
					{
						loader: "postcss-loader",
						options: { postcssOptions: { config: config.postcssConfigFile } },
					},
					{ loader: "sass-loader" },
				],
			},
			{
				test: /\.module\.(sa|sc|c)ss$/,
				use: [
					{ loader: MiniCssExtractPlugin.loader },
					{
						loader: "css-loader",
						options: { importLoaders: 1, modules: true, onlyLocals: false },
					},
					{
						loader: "postcss-loader",
						options: { postcssOptions: { config: config.postcssConfigFile } },
					},
					{ loader: "sass-loader" },
				],
			},
			{
				test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
				type: "asset/inline",
			},
			{
				test: /\.(png|jpe?g|gif)(\?\S*)?$/,
				type: "asset/resource", // automatically chooses between exporting a data URI and emitting a separate file.
				generator: {
					filename: (content) => {
						const file = path
							.resolve(content.filename)
							.replace(srcDir, "")
							// Replace backslashes with slashes.
							.replace(/\\/g, "/")
							// Remove leading slash.
							.replace(/^\/+/, "");

						return `${file.substring(0, file.lastIndexOf("/"))}/[name][ext]`;
					},
				},
			},
			{
				test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
				type: "asset/resource", // emits a separate file and exports the URL.
				generator: {
					filename: (content) => {
						const file = path
							.resolve(content.filename)
							.replace(srcDir, "")
							// Replace backslashes with slashes.
							.replace(/\\/g, "/")
							// Remove leading slash.
							.replace(/^\/+/, "");

						return `${file.substring(0, file.lastIndexOf("/"))}/[name][ext]`;
					},
				},
			},
		];
	};

	return {
		entry: entry(),
		output: output(),
		plugins: plugins(),
		module: {
			rules: rules(),
		},
		resolve: {
			extensions: ['.js', '.jsx',]
		},
	};
};

module.exports = { webpackConfiguration };
