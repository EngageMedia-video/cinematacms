import {
	Component,
	Suspense,
	createContext,
	lazy,
	use,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import { preload } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { normalizeMediaList, getMediaDurationLabel } from '../utils/mediaList';
import { getHeroDetailUrl, hasPlaybackPayload, mergeHeroDetail, getHeroPlayback } from '../utils/heroPlayback';
import { HOME_QUERY_KEYS } from '../queryClient';
import { cn } from '../../shared/utils/classNames';
import { HeroMediaCard, HeroMediaCardSkeleton } from './HeroMediaCard';
import HeroPlayButtonIcon from '../../shared/icons/hero-play-button.svg?react';

const HeroVideoPlayer = lazy(() => import('./HeroVideoPlayer'));

const HeroContext = createContext(null);

const HERO_DESKTOP_MIN_WIDTH = 1175;
const HERO_LAYOUT = 'flex w-full flex-col gap-6';
const HERO_LAYOUT_DESKTOP = 'flex-row items-start gap-[26px]';
const PLAYER_AREA = 'w-full min-w-0';
const PLAYER_AREA_DESKTOP = 'flex-1';
const PLAYER_FRAME = 'relative aspect-video w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50';
const PLAYER_FRAME_DESKTOP = 'h-[440px] aspect-auto';
const PLAYER_CLASS = 'relative h-full w-full overflow-hidden rounded-[6px] bg-cinemata-pacific-deep-50';
const CARD_AREA = 'w-full min-w-0';
const CARD_AREA_DESKTOP = 'h-[440px] w-[466px] shrink-0';

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

function PlayAffordance() {
	return (
		<div
			className="pointer-events-none absolute bottom-12 left-12 z-10 flex size-[72px] items-center justify-center max-[425px]:bottom-6 max-[425px]:left-6 max-[425px]:size-12"
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
	const { isDesktopLayout, isHeroDetailError, retryHeroDetail } = ctx;

	return (
		<div className={cn(PLAYER_AREA, isDesktopLayout ? PLAYER_AREA_DESKTOP : '')}>
			<div className={cn(PLAYER_FRAME, isDesktopLayout ? PLAYER_FRAME_DESKTOP : '')}>
				{playback.sources.length ? (
					<HeroPlayerErrorBoundary fallback={<HeroPosterFallback src={poster} />} key={playerKey}>
						<Suspense fallback={<HeroPosterFallback src={poster} />}>
							<HeroVideoPlayer
								key={playerKey}
								className={PLAYER_CLASS}
								sources={playback.sources}
								videoInfo={playback.videoInfo}
								poster={poster}
								preload="none"
								subtitles={subtitlesPayload}
							/>
						</Suspense>
					</HeroPlayerErrorBoundary>
				) : (
					<>
						<HeroPosterFallback src={poster} />
						{isHeroDetailError ? (
							<button
								type="button"
								onClick={() => retryHeroDetail()}
								className="body-body-12-medium absolute bottom-2 right-2 z-20 rounded-[4px] bg-cinemata-strait-blue-700 px-3 py-1.5 text-white hover:bg-cinemata-strait-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
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
	const { media, isDesktopLayout } = ctx;

	return <HeroMediaCard media={media} className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : '')} />;
}

export function HeroSection({ children }) {
	const { data, isLoading, isError, refetch } = useFeaturedMedia();
	const { rootRef, isDesktopLayout } = useHeroDesktopLayout();

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
		() => ({ media, isDesktopLayout, isHeroDetailError, retryHeroDetail }),
		[media, isDesktopLayout, isHeroDetailError, retryHeroDetail]
	);

	if (isError && !media) {
		return (
			<div ref={rootRef} className="w-full">
				<section
					className={cn(HERO_LAYOUT, isDesktopLayout ? HERO_LAYOUT_DESKTOP : '')}
					aria-label="Featured media"
				>
					<div className={cn(PLAYER_AREA, isDesktopLayout ? PLAYER_AREA_DESKTOP : '')}>
						<div className={cn(PLAYER_FRAME, isDesktopLayout ? PLAYER_FRAME_DESKTOP : '')}>
							<div className="flex h-full w-full items-center justify-center">
								<button
									type="button"
									onClick={() => refetch()}
									className="body-body-14-medium rounded-[4px] bg-cinemata-strait-blue-700 px-4 py-2 text-white hover:bg-cinemata-strait-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
								>
									RETRY
								</button>
							</div>
						</div>
					</div>
					<HeroMediaCardSkeleton className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : '')} />
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
							'aspect-video rounded-[6px] bg-cinemata-pacific-deep-100 animate-pulse',
							isDesktopLayout ? `${PLAYER_AREA_DESKTOP} ${PLAYER_FRAME_DESKTOP}` : ''
						)}
					/>
					<HeroMediaCardSkeleton className={cn(CARD_AREA, isDesktopLayout ? CARD_AREA_DESKTOP : '')} />
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
