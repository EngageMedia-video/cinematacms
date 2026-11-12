import { useRef, useState } from 'react';

const PREVIEW_BLOCKED_QUERY = '(prefers-reduced-motion: reduce), (hover: none)';

function isPreviewBlocked() {
	return typeof window !== 'undefined' && Boolean(window.matchMedia?.(PREVIEW_BLOCKED_QUERY).matches);
}

function isMovingWithin(event) {
	return event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget);
}

/**
 * Tracks whether an animated preview should replace a static thumbnail while
 * the pointer hovers, or keyboard focus sits inside, the element that receives
 * `containerProps`. The preview is requested only once that happens.
 */
export function useHoverPreview(previewSrc) {
	const [hovered, setHovered] = useState(false);
	const [focused, setFocused] = useState(false);
	const [loadedSrc, setLoadedSrc] = useState('');
	const [failedSrc, setFailedSrc] = useState('');
	// Focus caused by a pointer press is not keyboard focus and must not hold the preview.
	const pressedRef = useRef(false);
	const enabled = Boolean(previewSrc) && failedSrc !== previewSrc;

	function canStart() {
		return enabled && !isPreviewBlocked();
	}

	function onPointerEnter(event) {
		// Hybrid devices report (hover: hover) but still fire pointer events on tap.
		if (event.pointerType === 'touch' || !canStart()) {
			return;
		}
		setHovered(true);
	}

	function onPointerLeave(event) {
		// A tap moves focus only after its pointer has left, so a touch press stays recorded until blur.
		if (event.pointerType !== 'touch') {
			pressedRef.current = false;
		}
		setHovered(false);
		if (!focused) {
			setLoadedSrc('');
		}
	}

	function onPointerDown() {
		pressedRef.current = true;
	}

	function onFocus() {
		if (pressedRef.current || !canStart()) {
			return;
		}
		setFocused(true);
	}

	function onBlur(event) {
		if (isMovingWithin(event)) {
			return;
		}
		pressedRef.current = false;
		setFocused(false);
		if (!hovered) {
			setLoadedSrc('');
		}
	}

	return {
		containerProps: { onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur },
		previewProps:
			enabled && (hovered || focused)
				? {
						src: previewSrc,
						loaded: loadedSrc === previewSrc,
						onLoad: () => setLoadedSrc(previewSrc),
						onError: () => setFailedSrc(previewSrc),
					}
				: null,
	};
}
