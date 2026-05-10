/**
 * React wrapper around the @mediacms/media-player VideoJS class.
 * This file is the lazy-loaded boundary — importing it pulls in the full
 * videojs bundle, so it must stay in its own chunk.
 */
import { useRef, useEffect } from 'react';
import MediaPlayerClass from '@mediacms/media-player';
import '@mediacms/media-player/dist/mediacms-media-player.css';

export default function HeroVideoPlayer({ sources = [], poster = '', preload = 'metadata', subtitles = {} }) {
	const videoRef = useRef(null);
	const playerRef = useRef(null);

	useEffect(() => {
		if (!videoRef.current || playerRef.current) {
			return;
		}

		playerRef.current = new MediaPlayerClass(
			videoRef.current,
			{ sources, poster, preload, autoplay: false, subtitles },
			{},
			null,
			null,
			null
		);

		return () => {
			if (playerRef.current?.player?.dispose) {
				playerRef.current.player.dispose();
			}
			playerRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<div className="relative w-full aspect-video rounded-[6px] overflow-hidden bg-cinemata-pacific-deep-800">
			<video ref={videoRef} className="video-js w-full h-full" poster={poster} preload={preload} playsInline>
				{sources.map((src) => (
					<source key={src.src} src={src.src} type={src.type} />
				))}
				{subtitles?.languages?.map((track) => (
					<track
						key={track.srclang}
						kind="subtitles"
						src={track.src}
						srcLang={track.srclang}
						label={track.label}
					/>
				))}
			</video>
		</div>
	);
}
