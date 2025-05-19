module.exports = (ctx) => {
	const ret = {
		// parser: 'postcss-scss',
		// syntax: 'postcss-scss',
		map: ctx.env === "development" ? ctx.map : false,
		plugins: {
			// 'postcss-import': { root: ctx.file.dirname },
			// 'postcss-nested': {},
			autoprefixer: {},
			// cssnano: /*ctx.env === "production" ?*/ {} /*: false*/,  // Breaks customs properties support of 'postcss-custom-properties'.
			"postcss-custom-properties": {
				preserve: false,
			},
		},
	};

	return ret;
};
