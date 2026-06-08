import { Component, createContext, use, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { normalizeMediaList, getMediaDurationLabel } from '../utils/mediaList';
import { getHeroDetailUrl, hasPlaybackPayload, mergeHeroDetail, getHeroPlayback } from '../utils/heroPlayback';
import { HOME_QUERY_KEYS } from '../queryClient';
import { cn } from '../../shared/utils/classNames';
import { HeroMediaCard, HeroMediaCardSkeleton } from './HeroMediaCard';
import HeroVideoPlayer from './HeroVideoPlayer';
import HeroPlayButtonIcon from '../../shared/icons/hero-play-button.svg?react';

const HeroContext = createContext(null);

// Two-column layout engages by VIEWPORT width at the common 1366px laptop width.
// The common desktop CSS widths are 1280, 1366, 1440, 1536, 1920; 1366 and above
// render two columns (1366, 1440, 1536, 1920) and below it (1024, 1280) renders
// one column in both sidebar states. Two columns at 1280 left the text card too
// narrow, so the switch is set at 1366 where the card has more room. A
// container-width threshold cannot separate the close cases reliably: 1024 with
// the sidebar closed (~906px container) and 1280 with the sidebar open (~922px)
// are only ~16px apart. The container is still measured with a ResizeObserver to
// size the player and card, and must clear a floor (the `md` breakpoint, 768px)
// so two columns never render in a container too narrow to hold them.
const HERO_DESKTOP_MIN_VIEWPORT = 1366;
const HERO_CONTAINER_MIN_WIDTH = 768;
const HERO_GAP_PX = 26;
const HERO_CARD_MIN_WIDTH_PX = 320;
const HERO_CARD_MAX_WIDTH_PX = 466;
const HERO_CARD_WIDTH_RATIO = 0.36;
const HERO_HEIGHT_MIN_PX = 300;
const HERO_HEIGHT_MAX_PX = 440;
const HERO_PLAYER_ASPECT = 9 / 16;
const HERO_LAYOUT = 'flex w-full flex-col gap-6';
const HERO_LAYOUT_DESKTOP = 'flex-row items-start gap-[26px]';
const PLAYER_AREA = 'w-full min-w-0';
const PLAYER_AREA_DESKTOP = 'flex-1';
const PLAYER_FRAME = 'relative aspect-video w-full overflow-hidden rounded-[6px] bg-site-player-canvas';
const PLAYER_FRAME_DESKTOP = 'aspect-auto';
const PLAYER_CLASS = 'relative h-full w-full overflow-hidden rounded-[6px] bg-site-player-canvas';
// The card width is set via the computed inline style on desktop. Tailwind
// utilities are generated with !important in this project, so `w-full` would
// override that inline width and collapse the player. The card therefore takes
// `w-full` only on mobile (CARD_AREA_MOBILE) and relies on the inline width plus
// `shrink-0` on desktop.
const CARD_AREA = 'min-w-0';
const CARD_AREA_MOBILE = 'w-full';
const CARD_AREA_DESKTOP = 'shrink-0';

// Fluid two-column metrics. The card width scales with the container (clamped to
// a 320-466px band) and the shared player/card height is derived from the
// remaining player width at a 16:9 ratio (clamped to 300-440px). This keeps the
// player at a correct aspect ratio at every desktop width instead of forcing a
// fixed 440px height that squashes the video on narrower screens.
function computeHeroDesktopMetrics(containerWidth) {
	const cardWidth = Math.round(
		Math.min(HERO_CARD_MAX_WIDTH_PX, Math.max(HERO_CARD_MIN_WIDTH_PX, containerWidth * HERO_CARD_WIDTH_RATIO))
	);
	const playerWidth = containerWidth - cardWidth - HERO_GAP_PX;
	const height = Math.round(
		Math.min(HERO_HEIGHT_MAX_PX, Math.max(HERO_HEIGHT_MIN_PX, playerWidth * HERO_PLAYER_ASPECT))
	);
	return { cardWidth, height };
}

function heroPlayerFrameStyle(metrics) {
	// Fixed height keeps the player at a true 16:9 frame (the height is derived from
	// the player width at a 9/16 ratio in computeHeroDesktopMetrics). The card uses
	// the same value as a minHeight floor, so the two columns match while the player
	// never letterboxes.
	return metrics ? { height: metrics.height } : undefined;
}

function heroCardStyle(metrics) {
	// The card width is fixed, but the height is a floor, not a cap. It matches the
	// player height when the synopsis is short and grows past it when the text is
	// longer, so the card never clips the description or the author/country/views
	// block. The wrapper is a flex column and the card is flex-1 (see HeroMediaCard),
	// which lets the card fill the floor yet expand to its content height.
	return metrics ? { width: metrics.cardWidth, minHeight: metrics.height } : undefined;
}

class HeroPlayerErrorBoundary extends Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback;
		}

		return this.props.children;
	}
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

function useHeroDesktopLayout() {
	const rootRef = useRef(null);
	const [containerWidth, setContainerWidth] = useState(0);
	const [viewportWidth, setViewportWidth] = useState(0);

	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;

		const updateLayout = () => {
			setContainerWidth(root.getBoundingClientRect().width);
			setViewportWidth(window.innerWidth);
		};

		updateLayout();

		let resizeObserver;
		if ('undefined' !== typeof ResizeObserver) {
			resizeObserver = new ResizeObserver(updateLayout);
			resizeObserver.observe(root);
		}
		window.addEventListener('resize', updateLayout);
		return () => {
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			window.removeEventListener('resize', updateLayout);
		};
	}, []);

	const isDesktopLayout = viewportWidth >= HERO_DESKTOP_MIN_VIEWPORT && containerWidth >= HERO_CONTAINER_MIN_WIDTH;
	const desktopMetrics = useMemo(
		() => (isDesktopLayout ? computeHeroDesktopMetrics(containerWidth) : null),
		[isDesktopLayout, containerWidth]
	);

	return { rootRef, isDesktopLayout, desktopMetrics };
}

function PlayAffordance() {
	return (
		<div
			className="pointer-events-none absolute bottom-12 left-12 z-10 flex size-[72px] items-center justify-center max-[425px]:bottom-6 max-[425px]:left-6 max-[425px]:size-12"
			aria-hidden="true"
		>
			<HeroPlayButtonIcon className="size-[81.25%] text-site-player-accent" focusable="false" />
		</div>
	);
}

function DurationBadge({ value }) {
	if (!value) {
		return null;
	}

	return (
		<div className="body-body-12-regular absolute bottom-2 right-2 z-20 rounded-[2px] bg-bg-overlay-dark/80 px-1 py-[2px] leading-[13.5px] tracking-[0.5px] text-text-on-chrome">
			{value}
		</div>
	);
}

function HeroPosterFallback({ src }) {
	return (
		<>
			{src ? (
				<img
					src={src}
					alt="Video poster"
					width={1280}
					height={720}
					className="h-full w-full object-cover"
					loading="eager"
					fetchPriority="high"
				/>
			) : null}
			<PlayAffordance />
		</>
	);
}

function Player() {
	const ctx = use(HeroContext);
	const media = ctx?.media;
	const playableMedia = media ? (media.hero_playback ?? media) : null;
	const duration = getMediaDurationLabel(playableMedia ?? media);
	const poster = playableMedia?.poster_url || media?.thumbnail_url;
	const playback = useMemo(() => getHeroPlayback(playableMedia), [playableMedia]);
	const subtitlesSource = playableMedia?.subtitles_info;
	const subtitles = useMemo(
		() =>
			subtitlesSource?.map((s) => ({
				src: s.src ?? s.url,
				srclang: s.srclang ?? s.language,
				label: s.label ?? s.language_verbose ?? s.language,
			})) ?? [],
		[subtitlesSource]
	);
	const subtitlesPayload = useMemo(() => ({ languages: subtitles }), [subtitles]);
	const playerKey = playback.sources[0]?.src ?? poster ?? media?.friendly_token;

	if (!ctx || !media) return null;
	const { isDesktopLayout, desktopMetrics, isHeroDetailError, retryHeroDetail } = ctx;

	return (
		<div className={cn(PLAYER_AREA, isDesktopLayout ? PLAYER_AREA_DESKTOP : '')}>
			<div
				className={cn(PLAYER_FRAME, isDesktopLayout ? PLAYER_FRAME_DESKTOP : '')}
				style={heroPlayerFrameStyle(desktopMetrics)}
			>
				{playback.sources.length ? (
					<HeroPlayerErrorBoundary fallback={<HeroPosterFallback src={poster} />} key={playerKey}>
						<HeroVideoPlayer
							key={playerKey}
							className={PLAYER_CLASS}
							sources={playback.sources}
							videoInfo={playback.videoInfo}
							poster={poster}
							preload="none"
							subtitles={subtitlesPayload}
						/>
					</HeroPlayerErrorBoundary>
				) : (
					<>
						<HeroPosterFallback src={poster} />
						{isHeroDetailError ? (
							<button
								type="button"
								onClick={() => retryHeroDetail()}
								className="body-body-12-medium absolute bottom-2 right-2 z-20 rounded-[4px] bg-bg-primary px-3 py-1.5 text-text-on-primary hover:bg-bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
							>
								RETRY
							</button>
						) : (
							<DurationBadge value={duration} />
						)}
					</>
				)}
			</div>
		</div>
	);
}

function Card() {
	const ctx = use(HeroContext);
	if (!ctx) return null;
	const { media, isDesktopLayout, desktopMetrics } = ctx;

	return (
		<HeroMediaCard
			media={media}
			isDesktop={isDesktopLayout}
			className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : CARD_AREA_MOBILE)}
			style={heroCardStyle(desktopMetrics)}
		/>
	);
}

export function HeroSection({ children }) {
	const { data, isLoading, isError, refetch } = useFeaturedMedia();
	const { rootRef, isDesktopLayout, desktopMetrics } = useHeroDesktopLayout();

	const items = normalizeMediaList(data);
	const listMedia = items[0] ?? null;
	const { data: detailData, isError: isHeroDetailError, refetch: retryHeroDetail } = useHeroMediaDetail(listMedia);
	const media = mergeHeroDetail(listMedia, detailData);

	useEffect(() => {
		if (media?.thumbnail_url) {
			preload(media.thumbnail_url, { as: 'image' });
		}
	}, [media?.thumbnail_url]);

	const value = useMemo(
		() => ({ media, isDesktopLayout, desktopMetrics, isHeroDetailError, retryHeroDetail }),
		[media, isDesktopLayout, desktopMetrics, isHeroDetailError, retryHeroDetail]
	);

	if (isError && !media) {
		return (
			<div ref={rootRef} className="w-full">
				<section
					className={cn(HERO_LAYOUT, isDesktopLayout ? HERO_LAYOUT_DESKTOP : '')}
					aria-label="Featured media"
				>
					<div className={cn(PLAYER_AREA, isDesktopLayout ? PLAYER_AREA_DESKTOP : '')}>
						<div
							className={cn(PLAYER_FRAME, isDesktopLayout ? PLAYER_FRAME_DESKTOP : '')}
							style={heroPlayerFrameStyle(desktopMetrics)}
						>
							<div className="flex h-full w-full items-center justify-center">
								<button
									type="button"
									onClick={() => refetch()}
									className="body-body-14-medium rounded-[4px] bg-bg-primary px-4 py-2 text-text-on-primary hover:bg-bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
								>
									RETRY
								</button>
							</div>
						</div>
					</div>
					<HeroMediaCardSkeleton
						className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : CARD_AREA_MOBILE)}
						style={heroCardStyle(desktopMetrics)}
					/>
				</section>
			</div>
		);
	}

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
							'aspect-video rounded-[6px] bg-bg-skeleton animate-pulse',
							isDesktopLayout ? `${PLAYER_AREA_DESKTOP} ${PLAYER_FRAME_DESKTOP}` : ''
						)}
						style={heroPlayerFrameStyle(desktopMetrics)}
					/>
					<HeroMediaCardSkeleton
						className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : CARD_AREA_MOBILE)}
						style={heroCardStyle(desktopMetrics)}
					/>
				</div>
			</div>
		);
	}

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
