/**
 * React wrapper around the @mediacms/media-player VideoJS class.
 */
import { useRef, useEffect, useState } from 'react';
import 'video.js/dist/video-js.css';
import videojs from 'video.js/dist/video.es.js';
import '@mediacms/media-player/dist/mediacms-media-player.css';
import './HeroVideoPlayer.css';

const DEFAULT_PLAYER_CLASS = 'relative w-full aspect-video rounded-[6px] overflow-hidden bg-site-player-canvas';
let mediaPlayerClassPromise;

function getVideoJsPlayer(videoElement) {
	if (!videoElement) return null;
	return videojs.getPlayer?.(videoElement) ?? videojs(videoElement);
}

function loadMediaPlayerClass() {
	globalThis.videojs = videojs;

	if (!mediaPlayerClassPromise) {
		mediaPlayerClassPromise = import('@mediacms/media-player')
			.then(({ default: MediaPlayerClass }) => MediaPlayerClass)
			.catch((error) => {
				mediaPlayerClassPromise = undefined;
				throw error;
			});
	}

	return mediaPlayerClassPromise;
}

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
	const latestConfigRef = useRef({ sources, videoInfo, poster, preload, subtitles });
	const [playerReadyVersion, setPlayerReadyVersion] = useState(0);
	const sourcesKey = JSON.stringify(sources);
	latestConfigRef.current = { sources, videoInfo, poster, preload, subtitles };

	// Player instances are created once per mounted media item; HeroSection remounts this boundary when media changes.
	useEffect(() => {
		if (!videoRef.current || playerRef.current) {
			return;
		}

		const videoElement = videoRef.current;
		let isCancelled = false;

		loadMediaPlayerClass().then((MediaPlayerClass) => {
			if (isCancelled || !videoElement.isConnected || playerRef.current) {
				return;
			}

			const {
				sources: currentSources,
				videoInfo: currentVideoInfo,
				poster: currentPoster,
				preload: currentPreload,
				subtitles: currentSubtitles,
			} = latestConfigRef.current;
			const subtitleLanguages = Array.isArray(currentSubtitles?.languages) ? currentSubtitles.languages : [];
			const playerOptions = {
				enabledTouchControls: true,
				sources: currentSources,
				poster: currentPoster,
				autoplay: false,
				preload: currentPreload,
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
				currentVideoInfo,
				[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
				null,
				null,
				null
			);
			setPlayerReadyVersion((version) => version + 1);
		});

		return () => {
			isCancelled = true;
			if (playerRef.current?.dispose) {
				playerRef.current.dispose();
			} else {
				videojs.getPlayer?.(videoElement)?.dispose();
			}
			playerRef.current = null;
		};
	}, []);

	useEffect(() => {
		if (!playerRef.current) return;
		const player = getVideoJsPlayer(videoRef.current);
		if (!player) return;

		player.poster(poster || '');
		player.preload(preload);
		player.src(sources);
	}, [poster, preload, sourcesKey, playerReadyVersion]);

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
