import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../utils/mediaList';

const CONTENT_TYPE_COLORS = {
	film: { bg: '#00684F', text: '#fff' },
	webinar: { bg: '#ffe81a', text: '#000' },
	documentary: { bg: '#1A3F61', text: '#fff' },
};

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

	const contentType = item.media_content_type_info;

	return (
		<VerticalMovieItem
			title={item.title}
			imageSrc={item.thumbnail_url}
			link={item.url}
			duration={getMediaDurationLabel(item)}
			subtitle={getAuthorName(item)}
			metadata={metadata}
			badge={contentType?.title || ''}
			badgeColor={contentType ? CONTENT_TYPE_COLORS[contentType.value]?.bg || '#111111' : undefined}
			badgeTextColor={contentType ? CONTENT_TYPE_COLORS[contentType.value]?.text || '#fff' : undefined}
		/>
	);
}
