import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../utils/mediaList';

const DEFAULT_CATEGORY_COLOR = 'cinemata-neutral-600';

function getAuthorName(item) {
	return item.author_name || item.user || '';
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

export function MediaTile({ item }) {
	const metadata = [
		...getCountryNames(item),
		item.views != null ? `${Number(item.views).toLocaleString()} views` : null,
	];

	const categories = Array.isArray(item.categories_info) ? item.categories_info : [];
	const firstCategory = categories[0];

	return (
		<VerticalMovieItem
			title={item.title}
			imageSrc={item.thumbnail_url}
			link={item.url}
			duration={getMediaDurationLabel(item)}
			subtitle={getAuthorName(item)}
			metadata={metadata}
			badge={firstCategory?.title || ''}
			badgeColor={firstCategory?.color || DEFAULT_CATEGORY_COLOR}
		/>
	);
}
