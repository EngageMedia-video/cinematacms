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
