/**
 * React wrapper around the @mediacms/media-player VideoJS class.
 * This file is the lazy-loaded boundary — importing it pulls in the full
 * videojs bundle, so it must stay in its own chunk.
 */
import { useRef, useEffect } from 'react';
import videojs from 'video.js';
import MediaPlayerClass from '@mediacms/media-player';
import '@mediacms/media-player/dist/mediacms-media-player.css';
import './HeroVideoPlayer.css';

const DEFAULT_PLAYER_CLASS = 'relative w-full aspect-video rounded-[6px] overflow-hidden bg-cinemata-pacific-deep-50';

export default function HeroVideoPlayer({
	sources = [],
	videoInfo = {},
	poster = '',
	preload = 'metadata',
	subtitles = {},
	className = DEFAULT_PLAYER_CLASS,
}) {
	const videoRef = useRef(null);
	const playerRef = useRef(null);

	useEffect(() => {
		if (!videoRef.current || playerRef.current) {
			return;
		}

		const videoElement = videoRef.current;
		const subtitleLanguages = Array.isArray(subtitles?.languages) ? subtitles.languages : [];
		const playerOptions = {
			enabledTouchControls: true,
			sources,
			poster,
			autoplay: false,
			preload,
			bigPlayButton: true,
			controlBar: {
				theaterMode: false,
				pictureInPicture: false,
				next: false,
				previous: false,
			},
			subtitles: {
				on: subtitleLanguages.length > 0,
				languages: subtitleLanguages,
			},
			cornerLayers: {},
			videoPreviewThumb: {},
			vhsOptions: {
				useBandwidthFromLocalStorage: false,
				enableLowInitialPlaylist: true,
				limitRenditionByPlayerDimensions: true,
				useDevicePixelRatio: true,
				handlePartialData: true,
				maxPlaylistRetries: 2,
				playlistExclusionDuration: 60,
				withCredentials: true,
			},
		};

		playerRef.current = new MediaPlayerClass(
			videoElement,
			playerOptions,
			{
				volume: 1,
				soundMuted: false,
				theaterMode: false,
				theSelectedQuality: undefined,
				theSelectedPlaybackSpeed: 1,
			},
			videoInfo,
			[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
			null,
			null,
			null
		);

		return () => {
			videojs(videoElement).dispose();
			playerRef.current = null;
		};
	}, []);

	return (
		<div className={className || DEFAULT_PLAYER_CLASS}>
			<video
				ref={videoRef}
				className="video-js vjs-mediacms vjs-hero-player vjs-fill h-full w-full"
				style={{ width: '100%', height: '100%' }}
				poster={poster}
				preload={preload}
				playsInline
			/>
		</div>
	);
}
