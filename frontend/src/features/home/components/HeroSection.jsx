import { createContext, use, lazy, Suspense } from 'react';
import { preload } from 'react-dom';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { normalizeMediaList } from '../utils/mediaList';
import { formatDuration } from '../../shared/utils/formatDuration';
import { HeroMediaCard, HeroMediaCardSkeleton } from './HeroMediaCard';

const HeroVideoPlayer = lazy(() => import('./HeroVideoPlayer'));

const HeroContext = createContext(null);

const HERO_LAYOUT = 'flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-[26px]';
const PLAYER_AREA = 'w-full min-w-0 flex-1';
const PLAYER_FRAME =
	'relative aspect-video w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50 lg:aspect-auto lg:h-[480px]';
const PLAYER_CLASS = 'relative h-full w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50';
const CARD_AREA = 'w-full min-w-0 lg:h-[480px] lg:w-[466px] lg:shrink-0';
const PLAY_CIRCLE_PATH =
	'M52.8125 0C42.3672 0 32.1564 3.0974 23.4715 8.90051C14.7865 14.7036 8.01739 22.9518 4.02014 32.602C0.0228828 42.2523 -1.02298 52.8711 1.0148 63.1157C3.05258 73.3603 8.08249 82.7706 15.4684 90.1566C22.8544 97.5425 32.2647 102.572 42.5093 104.61C52.7539 106.648 63.3728 105.602 73.023 101.605C82.6732 97.6076 90.9214 90.8385 96.7245 82.1535C102.528 73.4686 105.625 63.2578 105.625 52.8125C105.61 38.8103 100.041 25.3858 90.1403 15.4848C80.2392 5.58369 66.8147 0.0147866 52.8125 0ZM73.4043 56.1539L46.9981 74.4352C46.3885 74.8567 45.6751 75.1034 44.9354 75.1486C44.1956 75.1939 43.4575 75.0358 42.8011 74.6917C42.1447 74.3475 41.5949 73.8303 41.2114 73.1961C40.8278 72.562 40.625 71.8349 40.625 71.0938V34.5312C40.625 33.7901 40.8278 33.063 41.2114 32.4289C41.5949 31.7947 42.1447 31.2775 42.8011 30.9333C43.4575 30.5892 44.1956 30.4311 44.9354 30.4764C45.6751 30.5216 46.3885 30.7683 46.9981 31.1898L73.4043 49.4711C73.9448 49.8448 74.3866 50.3441 74.6917 50.9261C74.9968 51.5081 75.1562 52.1554 75.1562 52.8125C75.1562 53.4696 74.9968 54.1169 74.6917 54.6989C74.3866 55.2809 73.9448 55.7802 73.4043 56.1539Z';
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

function getHeroDuration(media) {
	const rawDuration = media.duration_in_seconds ?? media.duration;

	if (rawDuration === undefined || rawDuration === null || rawDuration === '') {
		return '';
	}

	if ('string' === typeof rawDuration && rawDuration.includes(':')) {
		return rawDuration;
	}

	const seconds = Number(rawDuration);
	return Number.isFinite(seconds) && seconds > 0 ? formatDuration(Math.round(seconds)) : '';
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

function canUseVideoFormat(format) {
	return VIDEO_FORMAT_ORDER.includes(format);
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
			if (!url || !canUseVideoFormat(format)) return;

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

function getHeroPlayback(media) {
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

function PlayAffordance() {
	return (
		<div
			className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center lg:size-[130px]"
			aria-hidden="true"
		>
			<svg className="size-[81.25%] text-cinemata-strait-blue-400" viewBox="0 0 106 106" focusable="false">
				<path d={PLAY_CIRCLE_PATH} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
			</svg>
		</div>
	);
}

function DurationBadge({ value }) {
	if (!value) {
		return null;
	}

	return (
		<div className="body-body-12-regular absolute bottom-2 right-2 z-20 rounded-[2px] bg-cinemata-strait-blue-900/80 px-1 py-[2px] leading-[13.5px] tracking-[0.5px] text-cinemata-strait-blue-100">
			{value}
		</div>
	);
}

function HeroPosterFallback({ src }) {
	return (
		<>
			{src ? <img src={src} alt="Video poster" className="h-full w-full object-cover" loading="eager" /> : null}
			<PlayAffordance />
		</>
	);
}

function Player() {
	const ctx = use(HeroContext);
	if (!ctx) return null;
	const { media } = ctx;
	const playableMedia = media.hero_playback ?? null;
	const duration = getHeroDuration(playableMedia ?? media);
	const poster = playableMedia?.poster_url || media.thumbnail_url;
	const playback = getHeroPlayback(playableMedia);

	const subtitles = playableMedia?.subtitles_info
		? playableMedia.subtitles_info.map((s) => ({
				src: s.src ?? s.url,
				srclang: s.srclang ?? s.language,
				label: s.label ?? s.language_verbose ?? s.language,
			}))
		: [];

	return (
		<div className={PLAYER_AREA}>
			<div className={PLAYER_FRAME}>
				{playback.sources.length ? (
					<Suspense fallback={<HeroPosterFallback src={poster} />}>
						<HeroVideoPlayer
							className={PLAYER_CLASS}
							sources={playback.sources}
							videoInfo={playback.videoInfo}
							poster={poster}
							preload="none"
							subtitles={{ languages: subtitles }}
						/>
					</Suspense>
				) : (
					<>
						<HeroPosterFallback src={poster} />
						<DurationBadge value={duration} />
					</>
				)}
			</div>
		</div>
	);
}

function Card() {
	const ctx = use(HeroContext);
	if (!ctx) return null;
	const { media } = ctx;

	return <HeroMediaCard media={media} className={CARD_AREA} />;
}

export function HeroSection({ children }) {
	const { data, isLoading } = useFeaturedMedia();

	const items = normalizeMediaList(data);
	const media = items[0] ?? null;

	if (!isLoading && !media) {
		return null;
	}

	if (isLoading && !media) {
		return (
			<section className={HERO_LAYOUT} aria-busy="true" aria-label="Featured media">
				<div
					className={`${PLAYER_AREA} aspect-video rounded-[6px] bg-cinemata-pacific-deep-100 animate-pulse lg:aspect-auto lg:h-[480px]`}
				/>
				<HeroMediaCardSkeleton className={CARD_AREA} />
			</section>
		);
	}

	if (media?.thumbnail_url) {
		preload(media.thumbnail_url, { as: 'image' });
	}

	const value = { media };

	return (
		<HeroContext value={value}>
			<section className={HERO_LAYOUT} aria-label="Featured media">
				{children}
			</section>
		</HeroContext>
	);
}

HeroSection.Player = Player;
HeroSection.Card = Card;
