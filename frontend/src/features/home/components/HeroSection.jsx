import { createContext, use, lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { normalizeMediaList } from '../utils/mediaList';
import { HOME_QUERY_KEYS } from '../queryClient';
import { cn } from '../../shared/utils/classNames';
import { formatDuration } from '../../shared/utils/formatDuration';
import { HeroMediaCard, HeroMediaCardSkeleton } from './HeroMediaCard';
import HeroPlayButtonIcon from '../assets/hero-play-button.svg?react';

const HeroVideoPlayer = lazy(() => import('./HeroVideoPlayer'));

const HeroContext = createContext(null);

const HERO_DESKTOP_MIN_WIDTH = 1175;
const HERO_LAYOUT = 'flex w-full flex-col gap-6';
const HERO_LAYOUT_DESKTOP = 'flex-row items-start gap-[26px]';
const PLAYER_AREA = 'w-full min-w-0';
const PLAYER_AREA_DESKTOP = 'flex-1';
const PLAYER_FRAME = 'relative aspect-video w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50';
const PLAYER_FRAME_DESKTOP = 'h-[480px] aspect-auto';
const PLAYER_CLASS = 'relative h-full w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50';
const CARD_AREA = 'w-full min-w-0';
const CARD_AREA_DESKTOP = 'h-[480px] w-[466px] shrink-0';
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

function getHeroDetailUrl(media) {
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

function hasPlaybackPayload(media) {
	if (!media) return false;

	const playbackMedia = media.hero_playback ?? media;
	return Boolean(
		Object.values(playbackMedia.hls_info ?? {}).some(Boolean) || hasEncodingUrl(playbackMedia.encodings_info)
	);
}

function useHeroMediaDetail(media) {
	const detailUrl = getHeroDetailUrl(media);

	return useQuery({
		queryKey: HOME_QUERY_KEYS.heroDetail(detailUrl),
		queryFn: async () => {
			const response = await fetch(detailUrl);
			if (!response.ok) throw new Error(`Failed to fetch hero media detail: ${response.status}`);
			return response.json();
		},
		enabled: Boolean(media && detailUrl && !hasPlaybackPayload(media)),
	});
}

function mergeHeroDetail(media, detail) {
	if (!media || !detail) {
		return media;
	}

	return {
		...media,
		...detail,
		hero_playback: detail.hero_playback ?? detail,
	};
}

function useHeroDesktopLayout() {
	const rootRef = useRef(null);
	const [isDesktopLayout, setIsDesktopLayout] = useState(false);

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;

		const updateLayout = () => {
			setIsDesktopLayout(root.getBoundingClientRect().width >= HERO_DESKTOP_MIN_WIDTH);
		};

		updateLayout();

		if ('undefined' !== typeof ResizeObserver) {
			const resizeObserver = new ResizeObserver(updateLayout);
			resizeObserver.observe(root);
			return () => resizeObserver.disconnect();
		}

		window.addEventListener('resize', updateLayout);
		return () => window.removeEventListener('resize', updateLayout);
	}, []);

	return { rootRef, isDesktopLayout };
}

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
	const ctx = use(HeroContext);
	const isDesktopLayout = ctx?.isDesktopLayout ?? false;

	return (
		<div
			className={cn(
				'pointer-events-none absolute left-1/2 top-1/2 z-10 flex size-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center',
				isDesktopLayout ? 'size-[130px]' : ''
			)}
			aria-hidden="true"
		>
			<HeroPlayButtonIcon className="size-[81.25%] text-cinemata-strait-blue-400" focusable="false" />
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
	const { media, isDesktopLayout } = ctx;
	const playableMedia = media.hero_playback ?? media;
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
		<div className={cn(PLAYER_AREA, isDesktopLayout ? PLAYER_AREA_DESKTOP : '')}>
			<div className={cn(PLAYER_FRAME, isDesktopLayout ? PLAYER_FRAME_DESKTOP : '')}>
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
	const { media, isDesktopLayout } = ctx;

	return <HeroMediaCard media={media} className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : '')} />;
}

export function HeroSection({ children }) {
	const { data, isLoading } = useFeaturedMedia();
	const { rootRef, isDesktopLayout } = useHeroDesktopLayout();

	const items = normalizeMediaList(data);
	const listMedia = items[0] ?? null;
	const { data: detailData } = useHeroMediaDetail(listMedia);
	const media = mergeHeroDetail(listMedia, detailData);

	if (!isLoading && !media) {
		return null;
	}

	if (isLoading && !media) {
		return (
			<div ref={rootRef} className="w-full">
				<div
					className={cn(HERO_LAYOUT, isDesktopLayout ? HERO_LAYOUT_DESKTOP : '')}
					aria-busy="true"
					aria-label="Featured media"
					role="region"
				>
					<div
						className={cn(
							PLAYER_AREA,
							'aspect-video rounded-[6px] bg-cinemata-pacific-deep-100 animate-pulse',
							isDesktopLayout ? `${PLAYER_AREA_DESKTOP} ${PLAYER_FRAME_DESKTOP}` : ''
						)}
					/>
					<HeroMediaCardSkeleton className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : '')} />
				</div>
			</div>
		);
	}

	if (media?.thumbnail_url) {
		preload(media.thumbnail_url, { as: 'image' });
	}

	const value = { media, isDesktopLayout };

	return (
		<HeroContext value={value}>
			<div ref={rootRef} className="w-full">
				<section
					className={cn(HERO_LAYOUT, isDesktopLayout ? HERO_LAYOUT_DESKTOP : '')}
					aria-label="Featured media"
				>
					{children}
				</section>
			</div>
		</HeroContext>
	);
}

HeroSection.Player = Player;
HeroSection.Card = Card;
