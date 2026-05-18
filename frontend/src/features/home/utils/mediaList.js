import { formatDuration } from '../../shared/utils/formatDuration';

/**
 * TanStack Query returns the raw API shape; the API may return either a
 * paginated envelope `{ results: [...] }` or a bare array depending on the
 * endpoint version. This normalizes both shapes to a plain array.
 */
export function normalizeMediaList(data) {
	if (Array.isArray(data)) return data;
	if (Array.isArray(data?.playlist_media)) return data.playlist_media;
	if (Array.isArray(data?.results)) return data.results;
	return [];
}

/**
 * Renders a media item's duration as a display string ("MM:SS" or "H:MM:SS").
 * Accepts either a numeric seconds value or a pre-formatted string from the API.
 */
export function getMediaDurationLabel(media) {
	const raw = media?.duration_in_seconds ?? media?.duration;

	if (raw === undefined || raw === null || raw === '') {
		return '';
	}

	if ('string' === typeof raw && raw.includes(':')) {
		return raw;
	}

	const seconds = Number(raw);
	return Number.isFinite(seconds) && seconds >= 0 ? formatDuration(Math.round(seconds)) : '';
}
