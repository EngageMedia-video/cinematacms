import { useEffect, useRef } from 'react';
import { getExistingVideoPlayer } from '../../comments/utils/videoPlayer';

// Pauses the video player while a media-action dialog is open and resumes it
// when the dialog closes — or the component unmounts — only if this hook was
// the one that paused it. Keeping the player paused prevents the legacy
// autoplay transition (VideoViewer onVideoEnd → window.location.href) from
// navigating away and destroying the dialog (#806). Uses the non-creating
// player lookup and runs only while open, so mounting with a closed dialog
// never touches (or accidentally initializes) a player.
export function usePausePlayerWhileOpen(isOpen) {
	const wasPlayingRef = useRef(false);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		const player = getExistingVideoPlayer();
		if (player) {
			try {
				const isPlaying = typeof player.paused === 'function' && !player.paused();
				wasPlayingRef.current = isPlaying;
				if (isPlaying && typeof player.pause === 'function') {
					player.pause();
				}
			} catch {
				wasPlayingRef.current = false;
			}
		}

		// Cleanup covers both the dialog closing and the component unmounting
		// while open, so the player is never left paused with nothing to
		// resume it.
		return () => {
			if (!wasPlayingRef.current) {
				return;
			}
			wasPlayingRef.current = false;
			const current = getExistingVideoPlayer();
			if (!current || typeof current.play !== 'function') {
				return;
			}
			try {
				const result = current.play();
				if (result && typeof result.catch === 'function') {
					result.catch(() => {});
				}
			} catch {
				// Player may be mid-dispose during page teardown; resuming is
				// best-effort.
			}
		};
	}, [isOpen]);
}
