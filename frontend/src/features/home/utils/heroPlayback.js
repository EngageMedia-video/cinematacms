const VIDEO_FORMAT_ORDER = ['hls', 'h265', 'vp9', 'h264', 'vp8', 'mp4', 'theora'];
const VIDEO_FORMAT_EXTENSIONS = {
	hls: ['m3u8'],
	h265: ['mp4', 'webm'],
	vp9: ['mp4', 'webm'],
	h264: ['mp4', 'webm'],
	vp8: ['mp4', 'webm'],
	mp4: ['mp4'],
	theora: ['ogg'],
};

function getMediaTokenFromUrl(url) {
	if (!url) return '';

	try {
		const baseUrl = globalThis.location?.origin ?? 'http://localhost';
		const parsedUrl = new URL(url, baseUrl);
		return parsedUrl.searchParams.get('m') || '';
	} catch {
		return url.match(/[?&]m=([^&]+)/)?.[1] ?? '';
	}
}

export function getHeroDetailUrl(media) {
	if (!media) return '';

	if (media.api_url) {
		return media.api_url;
	}

	const token = getMediaTokenFromUrl(media.url || media.link);
	if (token) {
		return `/api/v1/media/${encodeURIComponent(token)}`;
	}

	const fallbackToken = media.friendly_token || media.uid || media.id;
	return fallbackToken ? `/api/v1/media/${encodeURIComponent(fallbackToken)}` : '';
}

function hasEncodingUrl(encodingsInfo) {
	return Object.values(encodingsInfo ?? {}).some((encodings) => {
		if (!encodings || 'object' !== typeof encodings) return false;
		if (encodings.url) return true;

		return Object.values(encodings).some((encoding) => encoding?.url);
	});
}

export function hasPlaybackPayload(media) {
	if (!media) return false;

	const playbackMedia = media.hero_playback ?? media;
	return Boolean(
		Object.values(playbackMedia.hls_info ?? {}).some(Boolean) || hasEncodingUrl(playbackMedia.encodings_info)
	);
}

export function mergeHeroDetail(media, detail) {
	if (!media || !detail) {
		return media;
	}

	return {
		...media,
		...detail,
		hero_playback: detail.hero_playback ?? detail,
	};
}

function formatMediaUrl(url) {
	if (!url) return '';

	if (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//') || url.startsWith('/')) {
		return url;
	}

	try {
		const baseUrl = globalThis.MediaCMS?.site?.url ?? globalThis.location?.origin ?? '';
		return new URL(url, baseUrl).toString();
	} catch {
		return url;
	}
}

function getUrlExtension(url) {
	return url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
}

function addVideoInfoSource(videoInfo, resolution, format, url) {
	videoInfo[resolution] = videoInfo[resolution] ?? { format: [], url: [] };
	videoInfo[resolution].format.push(format);
	videoInfo[resolution].url.push(formatMediaUrl(url));
}

function addHlsInfo(videoInfo, hlsInfo) {
	Object.entries(hlsInfo ?? {}).forEach(([key, url]) => {
		if (!url) return;

		if (key === 'master_file') {
			addVideoInfoSource(videoInfo, 'Auto', 'hls', url);
			return;
		}

		const [resolution, playlistType] = key.split('_');
		if (playlistType === 'playlist') {
			addVideoInfoSource(videoInfo, resolution, 'hls', url);
		}
	});
}

function addEncodingInfo(videoInfo, encodingsInfo) {
	Object.entries(encodingsInfo ?? {}).forEach(([resolution, encodings]) => {
		if (!encodings || 'object' !== typeof encodings) return;

		if (encodings.url) {
			const format = encodings.mime_type === 'application/x-mpegURL' ? 'hls' : 'h264';
			addVideoInfoSource(videoInfo, resolution, format, encodings.url);
			return;
		}

		VIDEO_FORMAT_ORDER.forEach((format) => {
			const encoding = encodings[format];
			const url = encoding?.url;
			if (!url) return;

			const extension = getUrlExtension(url);
			if (VIDEO_FORMAT_EXTENSIONS[format]?.includes(extension)) {
				addVideoInfoSource(videoInfo, resolution, format, url);
			}
		});
	});
}

function getHeroVideoInfo(media) {
	const videoInfo = {};
	addHlsInfo(videoInfo, media?.hls_info);
	addEncodingInfo(videoInfo, media?.encodings_info);
	return videoInfo;
}

function getDefaultVideoResolution(videoInfo) {
	if (videoInfo.Auto) return 'Auto';

	const resolutions = Object.keys(videoInfo)
		.map((key) => Number(key))
		.filter(Number.isFinite)
		.sort((a, b) => a - b);

	return String(resolutions.find((resolution) => resolution >= 720) ?? resolutions.at(-1) ?? '');
}

export function getHeroPlayback(media) {
	const videoInfo = getHeroVideoInfo(media);
	const defaultResolution = getDefaultVideoResolution(videoInfo);
	const defaultInfo = videoInfo[defaultResolution];

	if (!defaultInfo) {
		return { sources: [], videoInfo };
	}

	const sources = [];
	const hlsIndex = defaultInfo.format.indexOf('hls');
	if (hlsIndex >= 0) {
		sources.push({ src: defaultInfo.url[hlsIndex], type: 'application/x-mpegURL' });
	}

	defaultInfo.format.forEach((format, index) => {
		if (format !== 'hls') {
			sources.push({ src: defaultInfo.url[index], type: 'video/mp4' });
		}
	});

	return { sources, videoInfo };
}
