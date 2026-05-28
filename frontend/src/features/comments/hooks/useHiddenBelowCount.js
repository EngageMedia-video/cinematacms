import { useEffect, useState } from 'react';

/**
 * Counts how many `[data-comment]` items inside the given scroll container
 * sit fully below the visible scroll viewport. Use this to drive a
 * "X MORE" indicator pill that decrements as the user scrolls down.
 *
 * Returns 0 when the user has reached the bottom (or the container has
 * fewer items than fit on screen).
 */
export function useHiddenBelowCount(containerRef, totalCount) {
	const [hiddenBelow, setHiddenBelow] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return undefined;

		const recompute = () => {
			const items = el.querySelectorAll('[data-comment]');
			if (!items.length) {
				setHiddenBelow(0);
				return;
			}
			const containerRect = el.getBoundingClientRect();
			const viewportBottom = containerRect.bottom;
			let hidden = 0;
			for (const item of items) {
				const r = item.getBoundingClientRect();
				// Item is considered "below" if its top is past the visible bottom
				// (i.e. needs scrolling down to see).
				if (r.top >= viewportBottom - 8) hidden += 1;
			}
			setHiddenBelow(hidden);
		};

		recompute();
		el.addEventListener('scroll', recompute, { passive: true });
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recompute) : null;
		if (ro) ro.observe(el);
		window.addEventListener('resize', recompute);

		return () => {
			el.removeEventListener('scroll', recompute);
			window.removeEventListener('resize', recompute);
			if (ro) ro.disconnect();
		};
	}, [containerRef, totalCount]);

	return hiddenBelow;
}
