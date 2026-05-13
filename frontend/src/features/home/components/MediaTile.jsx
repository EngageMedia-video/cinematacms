import { formatDuration } from '../../shared/utils/formatDuration';
import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';

function getAuthorName(item) {
	return item.author_name || item.user || '';
}

function getDurationLabel(item) {
	const rawDuration = item.duration_in_seconds ?? item.duration;

	if (rawDuration === undefined || rawDuration === null || rawDuration === '') {
		return '';
	}

	if ('string' === typeof rawDuration && rawDuration.includes(':')) {
		return rawDuration;
	}

	const seconds = Number(rawDuration);
	return Number.isFinite(seconds) && seconds > 0 ? formatDuration(Math.round(seconds)) : '';
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

	return (
		<VerticalMovieItem
			title={item.title}
			imageSrc={item.thumbnail_url}
			link={item.url}
			duration={getDurationLabel(item)}
			subtitle={getAuthorName(item)}
			metadata={metadata}
		/>
	);
}
