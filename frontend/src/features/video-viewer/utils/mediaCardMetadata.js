export const DEFAULT_CATEGORY_COLOR = 'bg/primary';

// The media cards show the first category as a thumbnail badge, matching the
// homepage tile (MediaTile). Data comes from MediaSerializer.categories_info.
// Returns props ready to spread onto a MovieItem: { badge, badgeColor }.
export function getCategoryBadge(item) {
	const categories = Array.isArray(item.categories_info) ? item.categories_info : [];
	const first = categories[0];

	return {
		badge: first?.title || '',
		badgeColor: first?.color || DEFAULT_CATEGORY_COLOR,
	};
}

export function getAuthorName(item) {
	return item.author_name || item.user || '';
}

export function getAuthorLink(item) {
	return item.author_profile || '';
}

function getCountryNames(item) {
	if (Array.isArray(item.media_country_info)) {
		const countries = item.media_country_info.map((country) => country?.title).filter(Boolean);
		return countries.length ? countries : [item.media_country].filter(Boolean);
	}

	if (item.media_country_info?.title) {
		return [item.media_country_info.title];
	}

	return [item.media_country].filter(Boolean);
}

export function buildMetadata(item, hideViews) {
	const metadata = [...getCountryNames(item)];

	if (!hideViews && item.views != null) {
		metadata.push(`${Number(item.views).toLocaleString()} views`);
	}

	return metadata;
}
