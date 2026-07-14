export function getPlaylistTokenFromLocation(locationObject = window.location) {
	const configuredToken = window.MediaCMS?.playlistId;
	if (configuredToken) {
		return configuredToken;
	}

	const path = locationObject?.pathname || '';
	const segments = path.split('/').filter(Boolean);
	return segments[segments.length - 1] || '';
}

export function getPlaylistApiUrl(config, token) {
	const base = config?.api?.playlists || '/api/v1/playlists';
	return `${base.replace(/\/$/, '')}/${encodeURIComponent(token)}`;
}

export function getPlaylistPageUrl(config, token) {
	const base = config?.site?.url?.replace(/\/$/, '') || '';
	return `${base}/playlist/${encodeURIComponent(token)}`;
}

export function isOwnerPlaylist(config, playlist) {
	return Boolean(
		config?.member?.username &&
			!config?.member?.is?.anonymous &&
			playlist?.user &&
			playlist.user === config.member.username
	);
}

const RELATIVE_TIME_STEPS = [
	{ unit: 'year', seconds: 31536000 },
	{ unit: 'month', seconds: 2592000 },
	{ unit: 'week', seconds: 604800 },
	{ unit: 'day', seconds: 86400 },
	{ unit: 'hour', seconds: 3600 },
	{ unit: 'minute', seconds: 60 },
];

export function formatCreatedDate(value, now = new Date()) {
	if (!value) {
		return 'Created recently';
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Created recently';
	}

	const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
	const step = RELATIVE_TIME_STEPS.find(({ seconds }) => elapsedSeconds >= seconds);
	if (!step) {
		return 'Created just now';
	}

	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'always' });
	const amount = Math.floor(elapsedSeconds / step.seconds);
	return `Created ${formatter.format(-amount, step.unit)}`;
}

export function formatCount(value, singular, plural = `${singular}s`) {
	const count = Number(value) || 0;
	const label = count === 1 ? singular : plural;
	return `${new Intl.NumberFormat().format(count)} ${label}`;
}

export function getPlaylistViews(playlistMedia = []) {
	return playlistMedia.reduce((total, media) => total + (Number(media?.views) || 0), 0);
}

export function getMediaCountry(media) {
	const info = media?.media_country_info;
	if (Array.isArray(info) && info.length) {
		return info
			.map((item) => item?.title)
			.filter(Boolean)
			.join(', ');
	}
	if (typeof info?.title === 'string') {
		return info.title;
	}
	return '';
}

export function getMediaDescription(media) {
	return media?.summary || media?.description || '';
}

export function addPlaylistParam(mediaUrl, playlistToken) {
	if (!mediaUrl || !playlistToken) {
		return mediaUrl || '#';
	}

	try {
		const url = new URL(mediaUrl, window.location.origin);
		url.searchParams.set('pl', playlistToken);
		return url.toString();
	} catch {
		const separator = mediaUrl.includes('?') ? '&' : '?';
		return `${mediaUrl}${separator}pl=${encodeURIComponent(playlistToken)}`;
	}
}

export function moveItem(items, fromIndex, toIndex) {
	if (!Array.isArray(items) || fromIndex === toIndex) {
		return items;
	}

	if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
		return items;
	}

	const nextItems = [...items];
	const [item] = nextItems.splice(fromIndex, 1);
	nextItems.splice(toIndex, 0, item);
	return nextItems;
}

export function orderedPlaylistMedia(media = []) {
	return Array.isArray(media) ? [...media] : [];
}

// User bios (User.description) may contain HTML on deployments that enable
// pages.profile.htmlInDescription — the About page sanitizes and renders that
// markup. The playlist Bionote card renders plain text through ReadMore (which
// escapes markup and truncates raw characters), so derive display text first:
// block-level breaks become newlines, tags are dropped, entities are decoded.
export function htmlToPlainText(html) {
	if (!html) {
		return '';
	}

	const normalized = String(html)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n\n');
	const doc = new DOMParser().parseFromString(normalized, 'text/html');
	return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}
