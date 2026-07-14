const PLAYER_SELECTOR = '.video-js.vjs-mediacms';

export function getVideoPlayer() {
	if (typeof document === 'undefined' || typeof window === 'undefined') return null;
	const el = document.querySelector(PLAYER_SELECTOR);
	if (!el || typeof window.videojs !== 'function') return null;
	try {
		return window.videojs(el);
	} catch {
		return null;
	}
}

// Pure lookup, unlike getVideoPlayer: videojs(el) initializes a player with
// default options when the element has none yet, which must not happen from
// passive observers (e.g. before the page's configured player setup runs).
// Returns the already-initialized player or null.
export function getExistingVideoPlayer() {
	if (typeof document === 'undefined' || typeof window === 'undefined') return null;
	const el = document.querySelector(PLAYER_SELECTOR);
	if (!el || typeof window.videojs?.getPlayer !== 'function') return null;
	try {
		return window.videojs.getPlayer(el) ?? null;
	} catch {
		return null;
	}
}

export function getCurrentPlayerTime() {
	const player = getVideoPlayer();
	if (!player || typeof player.currentTime !== 'function') return null;
	try {
		const t = player.currentTime();
		return typeof t === 'number' && !Number.isNaN(t) ? t : null;
	} catch {
		return null;
	}
}

export function seekPlayerTo(seconds) {
	const player = getVideoPlayer();
	if (!player || typeof player.currentTime !== 'function') return false;
	try {
		const duration = typeof player.duration === 'function' ? player.duration() : null;
		const target = duration && seconds > duration ? duration : Math.max(0, seconds);
		player.currentTime(target);
		try {
			if (typeof player.paused === 'function' && player.paused() && typeof player.play === 'function') {
				const result = player.play();
				if (result && typeof result.catch === 'function') {
					result.catch(() => {});
				}
			}
		} catch {}
		return true;
	} catch {
		return false;
	}
}

export function getFriendlyTokenFromLocation() {
	if (typeof window === 'undefined') return null;
	const params = new URLSearchParams(window.location.search);
	const fromQuery = params.get('m');
	if (fromQuery) return fromQuery;
	if (window.MediaCMS && typeof window.MediaCMS.media_friendly_token === 'string') {
		return window.MediaCMS.media_friendly_token;
	}
	return null;
}
