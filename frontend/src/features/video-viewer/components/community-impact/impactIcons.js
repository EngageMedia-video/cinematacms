export const COMMUNITY_IMPACT_CATEGORIES = [
	{
		value: 'screening',
		label: 'Screened In',
	},
	{
		value: 'featured',
		label: 'Featured In',
	},
	{
		value: 'saves',
		label: 'Saves & Playlists',
	},
	{
		value: 'academic',
		label: 'Academic Usage',
	},
	{
		value: 'curated',
		label: 'Curated Into',
	},
];

export const IMPACT_ICON_CONFIG = {
	screening: {
		iconName: 'filmReel',
		label: 'Screened In',
		accentClassName: 'text-text-accent',
		iconShellClassName: 'bg-bg-impact-icon-screening text-text-secondary',
	},
	featured: {
		iconName: 'eye',
		label: 'Featured In',
		accentClassName: 'text-text-secondary',
		iconShellClassName: 'bg-bg-impact-icon-featured text-text-secondary',
	},
	saves: {
		iconName: 'bookmarkPennant',
		label: 'Saves & Playlists',
		accentClassName: 'text-text-link',
		iconShellClassName: 'bg-bg-impact-icon-saves text-text-impact-icon-saves',
	},
	academic: {
		iconName: 'bookFilled',
		label: 'Academic Usage',
		accentClassName: 'text-text-warning',
		iconShellClassName: 'bg-bg-impact-icon-academic text-text-accent',
	},
	curated: {
		iconName: 'curatedPlaylist',
		label: 'Curated Into',
		accentClassName: 'text-text-muted',
		iconShellClassName: 'bg-bg-impact-icon-curated text-text-muted',
	},
	heart: {
		iconName: 'heart',
		label: 'Community Impact',
		accentClassName: 'text-text-secondary',
		iconShellClassName: 'bg-bg-impact-icon-featured text-text-secondary',
	},
};

export function getImpactIconConfig(variant) {
	return IMPACT_ICON_CONFIG[variant] ?? IMPACT_ICON_CONFIG.screening;
}
