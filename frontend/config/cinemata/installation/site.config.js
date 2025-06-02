module.exports = {
	devEnv: "true" === process.env.WEBPACK_SERVE,
	id: process.env.MEDIACMS_ID || "mediacms-frontend",
	title: process.env.MEDIACMS_TITLE || "MediaCMS Demo",
	url: process.env.MEDIACMS_URL || "UNDEFINED_URL",
	api: process.env.MEDIACMS_API || "UNDEFINED_API",
	theme: {
		mode: "light", // Valid values: 'light', 'dark'.
		switch: {
			position: "sidebar", // Valid values: 'header', 'sidebar'.
		},
	},
	logo: {
		lightMode: {
			img: "./static/images/placeholder-logo-lightbg.svg",
			svg: "./static/images/placeholder-logo-lightbg.svg",
		},
		darkMode: {
			img: "./static/images/placeholder-logo-darkbg.svg",
			svg: "./static/images/placeholder-logo-darkbg.svg",
		},
	},
	pages: {
		latest: {
			title: "Recent uploads",
		},
		featured: {
			title: "Featured",
		},
		recommended: {
			title: "Popular",
		},
		members: {
			title: "Members",
		},
	},
	userPages: {
		liked: {
			title: "My favorites",
		},
		history: {
			title: "My history",
		},
	},
	taxonomies: {
		tags: {
			title: "Tags",
		},
		categories: {
			title: "Categories",
		},
		topics: {
			title: "Topics",
		},
		languages: {
			title: "Languages",
		},
		countries: {
			title: "Countries",
		},
	},
};
