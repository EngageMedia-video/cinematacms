import { createContext, use, lazy, Suspense } from 'react';
import { preload } from 'react-dom';
import { useFeaturedMedia } from '../hooks/useFeaturedMedia';
import { normalizeMediaList } from '../utils/mediaList';
import { ExpandableText } from './ExpandableText';

const HeroVideoPlayer = lazy(() => import('./HeroVideoPlayer'));

const HeroContext = createContext(null);

const HERO_LAYOUT = 'flex flex-col lg:flex-row gap-6 w-full';
const PLAYER_AREA = 'w-full lg:w-2/3 shrink-0';
const CARD_AREA = 'w-full lg:w-1/3 flex flex-col gap-4 min-w-0';

function HeroPosterFallback({ src }) {
	return (
		<div className="relative w-full aspect-video rounded-[6px] overflow-hidden bg-cinemata-pacific-deep-800">
			{src ? <img src={src} alt="Video poster" className="w-full h-full object-cover" loading="eager" /> : null}
		</div>
	);
}

function Player() {
	const ctx = use(HeroContext);
	if (!ctx) return null;
	const { media } = ctx;

	const sources = media.encodings_info
		? Object.values(media.encodings_info).flatMap((info) =>
				info.url ? [{ src: info.url, type: info.mime_type || 'video/mp4' }] : []
			)
		: [];

	const subtitles = media.subtitles_info
		? media.subtitles_info.map((s) => ({
				src: s.url,
				srclang: s.language,
				label: s.language_verbose || s.language,
			}))
		: [];

	return (
		<div className={PLAYER_AREA}>
			<Suspense fallback={<HeroPosterFallback src={media.thumbnail_url} />}>
				<HeroVideoPlayer
					sources={sources}
					poster={media.thumbnail_url}
					preload="metadata"
					subtitles={{ languages: subtitles }}
				/>
			</Suspense>
		</div>
	);
}

function Card() {
	const ctx = use(HeroContext);
	if (!ctx) return null;
	const { media } = ctx;

	const metaItems = [media.author_name, media.media_country].filter(Boolean);

	return (
		<div className={CARD_AREA}>
			<h2 className="heading-h4-32-medium m-0 text-cinemata-strait-blue-50">{media.title}</h2>

			{metaItems.length > 0 ? (
				<p className="body-body-14-regular text-cinemata-pacific-deep-400 m-0">{metaItems.join(' · ')}</p>
			) : null}

			{media.views !== undefined ? (
				<p className="body-body-12-regular text-cinemata-pacific-deep-400 m-0">
					{media.views.toLocaleString()} views
				</p>
			) : null}

			{media.description ? (
				<ExpandableText
					text={media.description}
					clampLines={6}
					className="text-cinemata-strait-blue-100 body-body-14-regular"
				/>
			) : null}
		</div>
	);
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
			<div className={HERO_LAYOUT} aria-busy="true">
				<div
					className={`${PLAYER_AREA} aspect-video rounded-[6px] bg-cinemata-pacific-deep-800 animate-pulse`}
				/>
				<div className={`${CARD_AREA} gap-3`}>
					<div className="h-8 rounded bg-cinemata-pacific-deep-800 animate-pulse w-3/4" />
					<div className="h-4 rounded bg-cinemata-pacific-deep-800 animate-pulse w-1/2" />
				</div>
			</div>
		);
	}

	if (media?.thumbnail_url) {
		preload(media.thumbnail_url, { as: 'image' });
	}

	const value = { media };

	return (
		<HeroContext value={value}>
			<div className={HERO_LAYOUT}>{children}</div>
		</HeroContext>
	);
}

HeroSection.Player = Player;
HeroSection.Card = Card;
