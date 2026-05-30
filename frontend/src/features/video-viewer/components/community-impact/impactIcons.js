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
		accentClassName: 'text-cinemata-coral-reef-400p',
		iconShellClassName: 'bg-cinemata-coral-reef-400p/15 text-cinemata-coral-reef-400p',
	},
	featured: {
		iconName: 'eye',
		label: 'Featured In',
		accentClassName: 'text-cinemata-strait-blue-400',
		iconShellClassName: 'bg-cinemata-strait-blue-400/15 text-cinemata-strait-blue-400',
	},
	saves: {
		iconName: 'bookmark',
		label: 'Saves & Playlists',
		accentClassName: 'text-cinemata-sunset-horizon-400p',
		iconShellClassName: 'bg-cinemata-sunset-horizon-400p/15 text-cinemata-sunset-horizon-400p',
	},
	academic: {
		iconName: 'bookOpen',
		label: 'Academic Usage',
		accentClassName: 'text-cinemata-amber-500',
		iconShellClassName: 'bg-cinemata-amber-500/15 text-cinemata-amber-500',
	},
	curated: {
		iconName: 'curatedPlaylist',
		label: 'Curated Into',
		accentClassName: 'text-cinemata-pacific-deep-400',
		iconShellClassName: 'bg-cinemata-pacific-deep-400/15 text-cinemata-pacific-deep-400',
	},
	heart: {
		iconName: 'heart',
		label: 'Community Impact',
		accentClassName: 'text-cinemata-strait-blue-400',
		iconShellClassName: 'bg-cinemata-strait-blue-400/15 text-cinemata-strait-blue-400',
	},
};

export function getImpactIconConfig(variant) {
	return IMPACT_ICON_CONFIG[variant] ?? IMPACT_ICON_CONFIG.screening;
}
