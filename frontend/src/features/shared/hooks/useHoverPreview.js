import { useState } from 'react';

const PREVIEW_BLOCKED_QUERY = '(prefers-reduced-motion: reduce), (hover: none)';

function isPreviewBlocked() {
	return typeof window !== 'undefined' && Boolean(window.matchMedia?.(PREVIEW_BLOCKED_QUERY).matches);
}

/**
 * Tracks whether an animated preview should replace a static thumbnail while
 * the pointer hovers, or keyboard focus sits inside, the element that receives
 * `containerProps`. The preview is requested only once that happens.
 */
export function useHoverPreview(previewSrc) {
	const [active, setActive] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [failedSrc, setFailedSrc] = useState('');
	const enabled = Boolean(previewSrc) && failedSrc !== previewSrc;

	function start(event) {
		// Hybrid devices report (hover: hover) but still fire pointer events on tap.
		if (!enabled || event.pointerType === 'touch' || isPreviewBlocked()) {
			return;
		}
		setActive(true);
	}

	function stop(event) {
		if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
			return;
		}
		setActive(false);
		setLoaded(false);
	}

	return {
		containerProps: {
			onPointerEnter: start,
			onPointerLeave: stop,
			onFocus: start,
			onBlur: stop,
		},
		previewProps:
			enabled && active
				? {
						src: previewSrc,
						loaded,
						onLoad: () => setLoaded(true),
						onError: () => {
							setFailedSrc(previewSrc);
							setActive(false);
							setLoaded(false);
						},
					}
				: null,
	};
}
