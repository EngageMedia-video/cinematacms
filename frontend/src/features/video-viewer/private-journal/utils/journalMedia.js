const PLAYER_SELECTOR = '.video-js.vjs-mediacms';

export function resolveAvatarSrc(url) {
	if (typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (trimmed === '' || trimmed === 'None' || trimmed === 'null' || trimmed === 'undefined') return null;
	return trimmed;
}

export function formatTimestamp(totalSeconds) {
	const n = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	const h = Math.floor(n / 3600);
	const m = Math.floor((n % 3600) / 60);
	const s = n % 60;
	const pad = (v) => String(v).padStart(2, '0');
	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatClock(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date
		.toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		})
		.replace(' ', '');
}

export function formatDayLabel(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const today = new Date();
	if (
		date.getFullYear() === today.getFullYear() &&
		date.getMonth() === today.getMonth() &&
		date.getDate() === today.getDate()
	) {
		return 'Today';
	}
	return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

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
