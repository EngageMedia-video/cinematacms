import { useEffect, useRef, useState } from 'react';
import { config as mediacmsConfig } from '../../../../../static/js/mediacms/config.js';
import { apiFetch } from '../../../utils/api';

// Sprite generation runs on the long_tasks worker, competing with the encode job that the
// same upload kicks off. For long/large videos the sheet can take a few minutes to appear,
// so poll for up to ~5 minutes (60 attempts x 5s) before giving up. The backend caps the
// tile count (SPRITE_MAX_TILES), which keeps generation bounded, but queue contention can
// still push the wait past the previous 60s budget.
const DEFAULT_MAX_ATTEMPTS = 60;
const DEFAULT_INTERVAL_MS = 5000;
const mediaDataCache = new Map();

function resolveThumbnailTime(nextValue, fallback) {
	return nextValue === '' || nextValue == null ? fallback : nextValue;
}

function getCachedMediaData(friendlyToken) {
	return friendlyToken ? mediaDataCache.get(friendlyToken) : null;
}

function setCachedMediaData(friendlyToken, mediaData) {
	if (friendlyToken && mediaData.spritesUrl) {
		mediaDataCache.set(friendlyToken, mediaData);
	}
}

export function clearSpritePollingCache() {
	mediaDataCache.clear();
}

function buildMediaApiUrl(friendlyToken) {
	if (!friendlyToken) {
		return '';
	}

	let base = '/api/v1/media';
	try {
		base = mediacmsConfig(window.MediaCMS).api.media || base;
	} catch (_e) {
		// window.MediaCMS not yet initialised (e.g. test environment); use default.
	}
	return `${base}/${encodeURIComponent(friendlyToken)}`;
}

export function useSpritePolling({
	friendlyToken,
	initialDuration = '',
	initialPosterUrl = '',
	initialSpritesUrl = '',
	initialThumbnailTime = '',
	initialSpriteNumSecs = '',
	intervalMs = DEFAULT_INTERVAL_MS,
	maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
	const cachedMediaData = getCachedMediaData(friendlyToken);
	const [mediaData, setMediaData] = useState({
		duration: initialDuration || cachedMediaData?.duration || '',
		posterUrl: initialPosterUrl || cachedMediaData?.posterUrl || '',
		spritesUrl: initialSpritesUrl || cachedMediaData?.spritesUrl || '',
		thumbnailTime: resolveThumbnailTime(initialThumbnailTime, cachedMediaData?.thumbnailTime ?? ''),
		spriteNumSecs: initialSpriteNumSecs || cachedMediaData?.spriteNumSecs || '',
	});
	const [status, setStatus] = useState(initialSpritesUrl || cachedMediaData?.spritesUrl ? 'ready' : 'idle');
	const previousFriendlyToken = useRef(friendlyToken);

	useEffect(() => {
		const tokenChanged = previousFriendlyToken.current !== friendlyToken;
		previousFriendlyToken.current = friendlyToken;
		const cached = getCachedMediaData(friendlyToken);

		setMediaData((current) => {
			const next = {
				duration: tokenChanged
					? initialDuration || cached?.duration || ''
					: initialDuration || current.duration || cached?.duration || '',
				posterUrl: tokenChanged
					? initialPosterUrl || cached?.posterUrl || ''
					: initialPosterUrl || current.posterUrl || cached?.posterUrl || '',
				spritesUrl: tokenChanged
					? initialSpritesUrl || cached?.spritesUrl || ''
					: initialSpritesUrl || current.spritesUrl || cached?.spritesUrl || '',
				thumbnailTime: resolveThumbnailTime(
					initialThumbnailTime,
					tokenChanged ? (cached?.thumbnailTime ?? '') : current.thumbnailTime
				),
				spriteNumSecs: tokenChanged
					? initialSpriteNumSecs || cached?.spriteNumSecs || ''
					: initialSpriteNumSecs || current.spriteNumSecs || cached?.spriteNumSecs || '',
			};
			setCachedMediaData(friendlyToken, next);
			return next;
		});

		setStatus((currentStatus) => {
			if (initialSpritesUrl || cached?.spritesUrl) {
				return 'ready';
			}

			if (tokenChanged) {
				return 'idle';
			}

			return currentStatus;
		});
	}, [
		friendlyToken,
		initialDuration,
		initialPosterUrl,
		initialSpritesUrl,
		initialThumbnailTime,
		initialSpriteNumSecs,
	]);

	useEffect(() => {
		if (initialSpritesUrl || mediaData.spritesUrl || !friendlyToken) {
			return undefined;
		}

		let cancelled = false;
		let attempts = 0;
		let timeoutId;

		async function poll() {
			if (cancelled || attempts >= maxAttempts) {
				if (!cancelled) {
					setStatus('unavailable');
				}
				return;
			}

			attempts += 1;
			setStatus('polling');

			try {
				const response = await apiFetch(buildMediaApiUrl(friendlyToken));

				if (cancelled) {
					return;
				}

				if (response.ok) {
					const data = await response.json();
					setMediaData((current) => {
						const next = {
							duration: data.duration ?? current.duration,
							posterUrl: data.poster_url ?? current.posterUrl,
							spritesUrl: data.sprites_url ?? current.spritesUrl,
							thumbnailTime: data.thumbnail_time ?? current.thumbnailTime,
							spriteNumSecs: data.sprite_num_secs ?? current.spriteNumSecs,
						};
						setCachedMediaData(friendlyToken, next);
						return next;
					});

					if (data.sprites_url) {
						setStatus('ready');
						return;
					}
				}
			} catch (_error) {
				// Keep polling; fresh uploads often need a little time before sprite data is ready.
			}

			if (!cancelled) {
				timeoutId = window.setTimeout(poll, intervalMs);
			}
		}

		poll();

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [friendlyToken, initialSpritesUrl, intervalMs, maxAttempts, mediaData.spritesUrl]);

	return {
		...mediaData,
		status,
	};
}
