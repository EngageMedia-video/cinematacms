export default {
	plugins: [
		{
			name: 'preset-default',
			params: {
				overrides: {
					removeViewBox: false,
					cleanupIds: false,
				},
			},
		},
		'removeDimensions',
		'removeScriptElement',
		'removeStyleElement',
		'removeXMLNS',
		'sortAttrs',
	],
};
