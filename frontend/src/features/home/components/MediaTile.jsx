import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../utils/mediaList';

const CATEGORY_COLORS = {
	animation: 'cinemata-amber-600p',
	documentary: 'cinemata-pacific-deep-600p',
	experimental: 'cinemata-coral-reef-700',
	explainer: 'cinemata-sandy-shore-700',
	fiction: 'cinemata-strait-blue-600p',
	hybrid: 'cinemata-neutral-600',
	'music-video': 'cinemata-red-700p',
	'news-reel': 'cinemata-green-700p',
	'participatory-video': 'cinemata-sunset-horizon-600',
	podcast: 'cinemata-coral-reef-400p',
	trailers: 'cinemata-amber-700',
};

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
			badgeColor={firstCategory ? CATEGORY_COLORS[firstCategory.slug] || DEFAULT_CATEGORY_COLOR : undefined}
		/>
	);
}
