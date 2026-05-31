import { useEffect, useState } from 'react';
import { getVideoPlayer } from '../utils/videoPlayer';

export function usePlayerReady() {
	const [ready, setReady] = useState(() => !!getVideoPlayer());

	useEffect(() => {
		if (ready || typeof window === 'undefined') return undefined;
		let cancelled = false;
		let attempts = 0;
		const timerId = window.setInterval(() => {
			if (cancelled) return;
			attempts += 1;
			if (getVideoPlayer()) {
				setReady(true);
				window.clearInterval(timerId);
				return;
			}
			if (attempts >= 20) {
				window.clearInterval(timerId);
			}
		}, 500);
		return () => {
			cancelled = true;
			window.clearInterval(timerId);
		};
	}, [ready]);

	return ready;
}
