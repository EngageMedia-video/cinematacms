// Visual identity of each stored impact category, shared by the film page section,
// the add-impact form, and the profile Impact tab. Labels name a category's rows on
// the profile Impact tab.
const IMPACT_ICON_CONFIG = {
	award: {
		iconName: 'impactCertificate',
		label: 'Awards',
		iconShellClassName: 'bg-bg-emblem-amber text-text-on-emblem-amber-light',
	},
	screening: {
		iconName: 'impactFilmReel',
		label: 'Screenings',
		iconShellClassName: 'bg-bg-emblem-pacific text-text-on-emblem-blue-deep',
	},
	teaching: {
		iconName: 'impactBookOpen',
		label: 'Teaching or Research',
		iconShellClassName: 'bg-bg-emblem-orange text-text-on-emblem-orange',
	},
	academic: {
		iconName: 'impactBookOpen',
		label: 'Academic Usage',
		iconShellClassName: 'bg-bg-emblem-orange text-text-on-emblem-orange',
	},
	referenced: {
		iconName: 'impactGraph',
		label: 'Referenced in Works',
		iconShellClassName: 'bg-bg-emblem-forest text-text-on-emblem-forest',
	},
	article: {
		iconName: 'impactNewspaper',
		label: 'Reviews and Features',
		iconShellClassName: 'bg-bg-emblem-red text-text-on-emblem-red',
	},
	featured: {
		iconName: 'impactNewspaper',
		label: 'Featured In',
		iconShellClassName: 'bg-bg-emblem-red text-text-on-emblem-red',
	},
	saves: {
		iconName: 'impactQueue',
		label: 'Playlists',
		iconShellClassName: 'bg-bg-emblem-green text-text-on-emblem-green',
	},
	curated: {
		iconName: 'impactQueue',
		label: 'Cinemata Curated Playlists',
		iconShellClassName: 'bg-bg-emblem-green text-text-on-emblem-green',
	},
	heart: {
		iconName: 'heart',
		label: 'Community Impact',
		iconShellClassName: 'bg-bg-emblem-blue text-text-secondary',
	},
};

export function getImpactIconConfig(variant) {
	return IMPACT_ICON_CONFIG[variant] ?? IMPACT_ICON_CONFIG.screening;
}

// Groups on the film page's Community Impact tab, in display order. Each group lists
// one or more stored categories. Playlists sit in their own column beside them, and
// curated entries stay out until curated playlists are built.
export const COMMUNITY_IMPACT_GROUPS = [
	{ key: 'award', title: 'Recognition', categories: ['award'] },
	{ key: 'screening', title: 'Screened at', categories: ['screening'] },
	{ key: 'referenced', title: 'Referenced in the following works', categories: ['referenced'] },
	{ key: 'teaching', title: 'Used in a course / class', categories: ['teaching', 'academic'] },
	{ key: 'article', title: 'Reviewed or featured in', categories: ['article', 'featured'] },
];
