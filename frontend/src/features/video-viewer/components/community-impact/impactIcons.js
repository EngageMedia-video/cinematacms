// Visual identity of each stored impact category. Labels name the card a category is
// shown in on the film page; the profile Impact tab reuses them for its rows.
export const IMPACT_ICON_CONFIG = {
	screening: {
		iconName: 'impactFilmReel',
		label: 'Screenings',
		iconShellClassName: 'bg-bg-emblem-blue-deep text-text-on-emblem-blue-deep',
	},
	article: {
		iconName: 'impactNewspaper',
		label: 'Reviews and Features',
		iconShellClassName: 'bg-bg-emblem-strait text-text-on-emblem-strait',
	},
	featured: {
		iconName: 'impactNewspaper',
		label: 'Featured In',
		iconShellClassName: 'bg-bg-emblem-strait text-text-on-emblem-strait',
	},
	referenced: {
		iconName: 'impactBookBookmark',
		label: 'Referenced in Works',
		iconShellClassName: 'bg-bg-emblem-strait-light text-text-on-emblem-strait',
	},
	award: {
		iconName: 'impactTrophy',
		label: 'Awards',
		iconShellClassName: 'bg-bg-emblem-amber text-text-on-emblem-amber',
	},
	teaching: {
		iconName: 'impactBookOpen',
		label: 'Teaching or Research',
		iconShellClassName: 'bg-bg-emblem-orange text-text-accent',
	},
	academic: {
		iconName: 'impactBookOpen',
		label: 'Academic Usage',
		iconShellClassName: 'bg-bg-emblem-orange text-text-accent',
	},
	saves: {
		iconName: 'bookmarkFilled',
		label: 'User Playlists',
		iconShellClassName: 'bg-bg-emblem-strait-deep text-text-on-emblem-strait-deep',
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

function plural(count, singular, pluralForm = `${singular}s`) {
	return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}

// Cards on the film page, in display order. Each card collects one or more stored
// categories: "summary" cards show a count, "list" cards preview the latest entries.
// Both open the full list in the impact detail dialog. The Cinemata Curated Playlists
// card (curated) stays out until curated playlists are built.
export const COMMUNITY_IMPACT_CARDS = [
	{
		key: 'saves',
		layout: 'summary',
		categories: ['saves'],
		describe: (count) => `In ${plural(count, 'playlist')}`,
	},
	{
		key: 'academic',
		layout: 'summary',
		categories: ['teaching', 'academic'],
		describe: (count) => `Used in ${plural(count, 'class', 'classes')}`,
	},
	{
		key: 'award',
		layout: 'summary',
		categories: ['award'],
		describe: (count) => plural(count, 'recognition'),
	},
	{
		key: 'screening',
		layout: 'list',
		categories: ['screening'],
		describe: (count) => `This film has been screened ${count.toLocaleString()}x`,
	},
	{
		key: 'article',
		layout: 'list',
		categories: ['article', 'featured'],
		describe: (count) => `Written about or featured ${count.toLocaleString()}x`,
	},
	{
		key: 'referenced',
		layout: 'list',
		categories: ['referenced'],
		describe: (count) => `Referenced in ${plural(count, 'work')}`,
	},
];
