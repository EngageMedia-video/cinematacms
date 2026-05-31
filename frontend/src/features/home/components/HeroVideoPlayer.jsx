import { VideoPlayer } from '../../../static/js/components/-NEW-/VideoPlayer.js';
import './HeroVideoPlayer.css';

const DEFAULT_PLAYER_CLASS = 'relative w-full aspect-video rounded-[6px] overflow-hidden bg-site-player-canvas';
const EMPTY_SUBTITLES = [];

function getSiteSettings() {
	const site = globalThis.MediaCMS?.site ?? {};
	const fallbackUrl = globalThis.location?.origin ?? '';

	return {
		id: String(site.id ?? site.site_id ?? 'cinemata'),
		url: String(site.url ?? fallbackUrl),
	};
}

function getSubtitlesInfo(subtitles) {
	return Array.isArray(subtitles?.languages) ? subtitles.languages : EMPTY_SUBTITLES;
}

export default function HeroVideoPlayer({
	sources = [],
	videoInfo = {},
	poster = '',
	subtitles = {},
	className = DEFAULT_PLAYER_CLASS,
}) {
	const site = getSiteSettings();

	return (
		<div className={className || DEFAULT_PLAYER_CLASS}>
			<div className="cinemata-hero-legacy-player video-player h-full w-full">
				<VideoPlayer
					playerVolume="1"
					playerSoundMuted={false}
					videoQuality="Auto"
					videoPlaybackSpeed={1}
					inTheaterMode={false}
					siteId={site.id}
					siteUrl={site.url}
					info={videoInfo}
					cornerLayers={{}}
					sources={sources}
					poster={poster}
					previewSprite={null}
					subtitlesInfo={getSubtitlesInfo(subtitles)}
					enableAutoplay={false}
					inEmbed={true}
					hasTheaterMode={false}
					hasNextLink={false}
					hasPreviousLink={false}
					errorMessage={null}
					debug={false}
				/>
			</div>
		</div>
	);
}
