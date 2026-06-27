import { useEffect, useMemo, useState } from 'react';

export const SPRITE_SOURCE_WIDTH = 160;
export const SPRITE_SOURCE_HEIGHT = 90;
// Rendered strip-cell width. The matching cell height is derived from the source
// aspect ratio in SpriteFrame (SPRITE_SOURCE_HEIGHT * width / SPRITE_SOURCE_WIDTH)
// so the background offset and scale always agree — see SpriteFrame.jsx.
export const SPRITE_FRAME_WIDTH = 78.421;

const spriteRowsCache = new Map();

export function formatFrameTime(totalSeconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const seconds = safeSeconds % 60;

	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildSpriteFrames({ duration, rowsInSheet, spriteSecs }) {
	const numericDuration = Number(duration) || 0;
	const numericRows = Number(rowsInSheet) || 0;
	const numericSpriteSecs = Number(spriteSecs) || 10;

	if (numericDuration <= 0 || numericRows <= 0 || numericSpriteSecs <= 0) {
		return [];
	}

	const frameCount = Math.min(Math.ceil(numericDuration / numericSpriteSecs), numericRows);

	return Array.from({ length: frameCount }, (_, index) => {
		const seconds = index * numericSpriteSecs;

		return {
			index,
			seconds,
			mmss: formatFrameTime(seconds),
		};
	});
}

export function useSpriteFrames({ spritesUrl, duration, spriteSecs }) {
	const cachedRows = spritesUrl ? spriteRowsCache.get(spritesUrl) : 0;
	const [rowsInSheet, setRowsInSheet] = useState(cachedRows || 0);
	const [status, setStatus] = useState(cachedRows ? 'ready' : spritesUrl ? 'loading' : 'idle');

	useEffect(() => {
		if (!spritesUrl) {
			setRowsInSheet(0);
			setStatus('idle');
			return undefined;
		}

		const cached = spriteRowsCache.get(spritesUrl);
		if (cached) {
			setRowsInSheet(cached);
			setStatus('ready');
			return undefined;
		}

		let cancelled = false;
		const image = new Image();
		// Decoding the stacked sprite JPEG can take a while for longer videos (taller sheet).
		// The backend caps tile count so the sheet height stays bounded, but slower devices
		// still need more than the previous 10s before we declare the preview unavailable.
		const timeoutId = window.setTimeout(() => {
			if (!cancelled) {
				setRowsInSheet(0);
				setStatus('error');
			}
		}, 30000);
		setStatus('loading');
		setRowsInSheet(0);

		image.onload = () => {
			if (cancelled) return;
			window.clearTimeout(timeoutId);

			const rows = Math.floor((image.naturalHeight || 0) / SPRITE_SOURCE_HEIGHT);
			if (rows > 0) {
				spriteRowsCache.set(spritesUrl, rows);
				setRowsInSheet(rows);
				setStatus('ready');
			} else {
				setStatus('error');
			}
		};
		image.onerror = () => {
			if (!cancelled) {
				window.clearTimeout(timeoutId);
				setRowsInSheet(0);
				setStatus('error');
			}
		};
		image.src = spritesUrl;

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [spritesUrl]);

	const frames = useMemo(
		() => buildSpriteFrames({ duration, rowsInSheet, spriteSecs }),
		[duration, rowsInSheet, spriteSecs]
	);

	return { frames, status, rowsInSheet };
}
