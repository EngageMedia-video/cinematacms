import { useEffect, useRef } from 'react';
import { getVideoPlayer } from '../../comments/utils/videoPlayer';

// Pauses the video player while a media-action dialog is open and resumes it
// on close only if this hook was the one that paused it. Keeping the player
// paused prevents the legacy autoplay transition (VideoViewer onVideoEnd →
// window.location.href) from navigating away and destroying the dialog (#806).
export function usePausePlayerWhileOpen(isOpen) {
	const wasPlayingRef = useRef(false);

	useEffect(() => {
		const player = getVideoPlayer();
		if (!player) {
			return;
		}

		try {
			if (isOpen) {
				const isPlaying = typeof player.paused === 'function' && !player.paused();
				wasPlayingRef.current = isPlaying;
				if (isPlaying && typeof player.pause === 'function') {
					player.pause();
				}
			} else if (wasPlayingRef.current) {
				wasPlayingRef.current = false;
				if (typeof player.play === 'function') {
					const result = player.play();
					if (result && typeof result.catch === 'function') {
						result.catch(() => {});
					}
				}
			}
		} catch {
			// Player may be mid-dispose during page teardown; playback state is
			// best-effort here.
		}
	}, [isOpen]);
}
