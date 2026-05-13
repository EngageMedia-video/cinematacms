import { createContext, use, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Icon } from '../../shared/components/Icon';
import { MediaTile } from './MediaTile';
import {
	CAROUSEL_GAP_PX as GAP_PX,
	CAROUSEL_MAX_VISIBLE_COUNT as DEFAULT_VISIBLE_COUNT,
	CAROUSEL_MIN_ITEM_WIDTH_PX as MIN_ITEM_WIDTH_PX,
	CAROUSEL_RESPONSIVE_VISIBLE_COUNT_QUERIES as RESPONSIVE_VISIBLE_COUNT_QUERIES,
} from './carouselLayout';

const CarouselContext = createContext(null);

const SWIPE_THRESHOLD_PX = 48;

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function isClient() {
	return 'undefined' !== typeof window;
}

function getResponsiveVisibleCount() {
	if (!isClient() || !window.matchMedia) {
		return DEFAULT_VISIBLE_COUNT;
	}

	const match = RESPONSIVE_VISIBLE_COUNT_QUERIES.find(({ query }) => window.matchMedia(query).matches);
	return match?.visibleCount ?? DEFAULT_VISIBLE_COUNT;
}

function getVisibleCountForWidth(width) {
	if (!width || width <= 0) {
		return getResponsiveVisibleCount();
	}

	const count = Math.floor((width + GAP_PX) / (MIN_ITEM_WIDTH_PX + GAP_PX));
	return clamp(count, 1, DEFAULT_VISIBLE_COUNT);
}

function installViewportFallbackVisibleCount(setResponsiveVisibleCount) {
	if (!isClient() || !window.matchMedia) {
		setResponsiveVisibleCount(DEFAULT_VISIBLE_COUNT);
		return undefined;
	}

	const mediaQueries = RESPONSIVE_VISIBLE_COUNT_QUERIES.map(({ query }) => window.matchMedia(query));
	const updateVisibleCount = () => setResponsiveVisibleCount(getResponsiveVisibleCount());

	updateVisibleCount();
	mediaQueries.forEach((mediaQuery) => {
		if (mediaQuery.addEventListener) {
			mediaQuery.addEventListener('change', updateVisibleCount);
		} else {
			mediaQuery.addListener(updateVisibleCount);
		}
	});

	return () => {
		mediaQueries.forEach((mediaQuery) => {
			if (mediaQuery.removeEventListener) {
				mediaQuery.removeEventListener('change', updateVisibleCount);
			} else {
				mediaQuery.removeListener(updateVisibleCount);
			}
		});
	};
}

function useCarouselVisibleCount(visibleCount, rootRef) {
	const [responsiveVisibleCount, setResponsiveVisibleCount] = useState(
		() => visibleCount ?? getResponsiveVisibleCount()
	);

	useEffect(() => {
		if (visibleCount !== undefined) {
			setResponsiveVisibleCount(visibleCount);
			return undefined;
		}

		const root = rootRef.current;
		if (root && isClient() && 'undefined' !== typeof ResizeObserver) {
			const updateVisibleCount = (width) => {
				setResponsiveVisibleCount(getVisibleCountForWidth(width));
			};
			const resizeObserver = new ResizeObserver((entries) => {
				const width = entries[0]?.contentRect?.width ?? root.getBoundingClientRect().width;
				updateVisibleCount(width);
			});

			updateVisibleCount(root.getBoundingClientRect().width || root.clientWidth);
			resizeObserver.observe(root);

			return () => resizeObserver.disconnect();
		}

		return installViewportFallbackVisibleCount(setResponsiveVisibleCount);
	}, [visibleCount, rootRef]);

	return responsiveVisibleCount;
}

function releasePointerCapture(target, pointerId) {
	try {
		target.releasePointerCapture?.(pointerId);
	} catch {
		// Ignore stale pointer capture releases from cancelled gestures.
	}
}

function CarouselTrack() {
	const { items, visibleCount, pageCount, currentPage, goPrev, goNext, goToPage, atStart, atEnd } =
		use(CarouselContext);
	const trackRef = useRef(null);
	const nativeScrollPageChangeRef = useRef(null);
	const programmaticScrollTargetRef = useRef(null);
	const swipeStartRef = useRef(null);
	const didSwipeRef = useRef(false);

	// N items + N-1 gaps = container.
	const itemWidth = `calc(${100 / visibleCount}% - ${(visibleCount - 1) / visibleCount}rem)`;

	const getPageScrollLeft = useCallback((page) => {
		const track = trackRef.current;
		if (!track) return 0;

		const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
		const pageWidth = track.clientWidth + GAP_PX;
		return Math.min(page * pageWidth, maxScrollLeft);
	}, []);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return undefined;

		const nextScrollLeft = getPageScrollLeft(currentPage);
		if (nativeScrollPageChangeRef.current === currentPage) {
			nativeScrollPageChangeRef.current = null;
			return undefined;
		}

		if (Math.abs(track.scrollLeft - nextScrollLeft) <= 1) return undefined;

		programmaticScrollTargetRef.current = nextScrollLeft;
		track.scrollTo({ left: nextScrollLeft, behavior: 'smooth' });

		return () => {
			programmaticScrollTargetRef.current = null;
		};
	}, [currentPage, getPageScrollLeft, items, visibleCount]);

	const handleScroll = useCallback(
		(event) => {
			const track = event.currentTarget;
			const programmaticScrollTarget = programmaticScrollTargetRef.current;
			if (programmaticScrollTarget !== null) {
				if (Math.abs(track.scrollLeft - programmaticScrollTarget) <= 1) {
					programmaticScrollTargetRef.current = null;
				}
				return;
			}

			const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
			const pageWidth = track.clientWidth + GAP_PX;
			const page =
				maxScrollLeft > 0 && track.scrollLeft >= maxScrollLeft - 1
					? pageCount - 1
					: Math.round(track.scrollLeft / pageWidth);
			const nextPage = clamp(page, 0, pageCount - 1);

			if (nextPage !== currentPage) {
				nativeScrollPageChangeRef.current = nextPage;
				goToPage(nextPage);
			}
		},
		[currentPage, goToPage, pageCount]
	);

	const handleWheel = useCallback(() => {
		programmaticScrollTargetRef.current = null;
	}, []);

	const handlePointerDown = useCallback((event) => {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		programmaticScrollTargetRef.current = null;
		didSwipeRef.current = false;
		swipeStartRef.current = { x: event.clientX, y: event.clientY, scrollLeft: event.currentTarget.scrollLeft };
		event.currentTarget.setPointerCapture?.(event.pointerId);
	}, []);

	const handlePointerUp = useCallback(
		(event) => {
			const start = swipeStartRef.current;
			swipeStartRef.current = null;
			releasePointerCapture(event.currentTarget, event.pointerId);

			if (!start) {
				return;
			}

			const deltaX = event.clientX - start.x;
			const deltaY = event.clientY - start.y;
			const isHorizontalSwipe = Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY);

			if (!isHorizontalSwipe) {
				return;
			}

			didSwipeRef.current = true;

			if (Math.abs(event.currentTarget.scrollLeft - start.scrollLeft) > 2) {
				return;
			}

			if (deltaX < 0 && !atEnd) {
				goNext();
			} else if (deltaX > 0 && !atStart) {
				goPrev();
			}
		},
		[atEnd, atStart, goNext, goPrev]
	);

	const handlePointerCancel = useCallback((event) => {
		swipeStartRef.current = null;
		didSwipeRef.current = false;
		releasePointerCapture(event.currentTarget, event.pointerId);
	}, []);

	const handleClickCapture = useCallback((event) => {
		if (!didSwipeRef.current) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		didSwipeRef.current = false;
	}, []);

	return (
		<div
			ref={trackRef}
			className="snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			data-carousel-track
			onScroll={handleScroll}
			onWheel={handleWheel}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onClickCapture={handleClickCapture}
			style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
		>
			<div className="flex gap-4">
				{items.map((item) => (
					<div
						key={item.friendly_token ?? item.id ?? item.url}
						style={{ flexShrink: 0, flexGrow: 0, scrollSnapAlign: 'start', width: itemWidth }}
					>
						<MediaTile item={item} />
					</div>
				))}
			</div>
		</div>
	);
}

function CarouselArrows() {
	const { atStart, atEnd, goPrev, goNext } = use(CarouselContext);

	return (
		<div className="flex items-center gap-2">
			<button
				type="button"
				onClick={goPrev}
				disabled={atStart}
				aria-label="Previous page"
				className="rounded p-1 text-cinemata-strait-blue-50 hover:bg-cinemata-pacific-deep-700 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
			>
				&#8249;
			</button>
			<button
				type="button"
				onClick={goNext}
				disabled={atEnd}
				aria-label="Next page"
				className="rounded p-1 text-cinemata-strait-blue-50 hover:bg-cinemata-pacific-deep-700 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
			>
				&#8250;
			</button>
		</div>
	);
}

function CarouselOverlayArrows() {
	const { atStart, atEnd, goPrev, goNext } = use(CarouselContext);
	const btnClass =
		'pointer-events-auto absolute top-1/2 z-10 hidden size-[70px] -translate-y-1/2 items-center justify-center border-0 bg-transparent p-0 text-cinemata-strait-blue-700 transition-colors hover:text-cinemata-strait-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200 focus-visible:ring-offset-2 focus-visible:ring-offset-cinemata-pacific-deep-50 md:flex dark:text-cinemata-strait-blue-600p dark:hover:text-cinemata-strait-blue-400 dark:focus-visible:ring-offset-cinemata-pacific-deep-950';

	return (
		<>
			{!atStart && (
				<button type="button" onClick={goPrev} aria-label="Previous page" className={`${btnClass} -left-8`}>
					<Icon name="caretCircleRight" size={70} className="rotate-180" decorative />
				</button>
			)}
			{!atEnd && (
				<button type="button" onClick={goNext} aria-label="Next page" className={`${btnClass} -right-8`}>
					<Icon name="caretCircleRight" size={70} decorative />
				</button>
			)}
		</>
	);
}

function CarouselIndicator({ count, activeIndex, onSelect }) {
	return (
		<div className="flex items-center gap-2" role="group" aria-label="Page navigation">
			{Array.from({ length: count }, (_, i) => (
				<button
					key={i}
					type="button"
					onClick={() => onSelect(i)}
					aria-label={`Go to page ${i + 1}`}
					aria-current={i === activeIndex ? 'true' : undefined}
					className={`rounded-full p-0 border-0 focus:outline-none ${
						i === activeIndex
							? 'h-2 w-6 bg-cinemata-strait-blue-800 dark:bg-white transition-[width,background-color] duration-300'
							: 'size-2 min-w-0 bg-cinemata-pacific-deep-400/30 hover:bg-cinemata-pacific-deep-400/50 dark:bg-white/30 dark:hover:bg-white/50'
					}`}
				/>
			))}
		</div>
	);
}

function CarouselDots() {
	const { pageCount, currentPage, goToPage } = use(CarouselContext);
	return <CarouselIndicator count={pageCount} activeIndex={currentPage} onSelect={goToPage} />;
}

function DefaultCarouselBody() {
	const { visibleCount } = use(CarouselContext);
	return (
		<>
			<div className="relative">
				<CarouselTrack />
				<div
					className="pointer-events-none absolute inset-x-0 top-0"
					style={{ aspectRatio: `${visibleCount * 16} / 9` }}
				>
					<div className="relative h-full w-full">
						<CarouselOverlayArrows />
					</div>
				</div>
			</div>
			<div className="mt-3 flex justify-center">
				<CarouselDots />
			</div>
		</>
	);
}

export function Carousel({
	items = [],
	visibleCount,
	currentPage: controlledPage,
	onPageChange,
	defaultPage = 0,
	children,
}) {
	const rootRef = useRef(null);
	const didMountRef = useRef(false);
	const [internalPage, setInternalPage] = useState(defaultPage);
	const resolvedVisibleCount = useCarouselVisibleCount(visibleCount, rootRef);
	const safeVisibleCount = Math.max(1, resolvedVisibleCount);

	const isControlled = controlledPage !== undefined;
	const currentPage = isControlled ? controlledPage : internalPage;
	const pageCount = Math.max(1, Math.ceil(items.length / safeVisibleCount));
	const safePage = clamp(currentPage, 0, pageCount - 1);
	const atStart = safePage === 0;
	const atEnd = safePage >= pageCount - 1;

	useEffect(() => {
		if (!isControlled) {
			setInternalPage((page) => clamp(page, 0, pageCount - 1));
		}
	}, [isControlled, pageCount]);

	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			return;
		}

		if (!isControlled) {
			setInternalPage(0);
		}
	}, [isControlled, items]);

	const goPrev = useCallback(() => {
		if (isControlled) {
			onPageChange?.(clamp(safePage - 1, 0, pageCount - 1));
		} else {
			setInternalPage((p) => clamp(p - 1, 0, pageCount - 1));
		}
	}, [isControlled, safePage, onPageChange, pageCount]);

	const goNext = useCallback(() => {
		if (isControlled) {
			onPageChange?.(clamp(safePage + 1, 0, pageCount - 1));
		} else {
			setInternalPage((p) => clamp(p + 1, 0, pageCount - 1));
		}
	}, [isControlled, safePage, onPageChange, pageCount]);

	const goToPage = useCallback(
		(page) => {
			const clamped = clamp(page, 0, pageCount - 1);
			if (isControlled) {
				onPageChange?.(clamped);
			} else {
				setInternalPage(clamped);
			}
		},
		[isControlled, onPageChange, pageCount]
	);

	const value = useMemo(
		() => ({
			items,
			visibleCount: safeVisibleCount,
			pageCount,
			currentPage: safePage,
			goPrev,
			goNext,
			goToPage,
			atStart,
			atEnd,
		}),
		[items, safeVisibleCount, pageCount, safePage, goPrev, goNext, goToPage, atStart, atEnd]
	);

	return (
		<div ref={rootRef} data-carousel>
			<CarouselContext value={value}>{children ?? <DefaultCarouselBody />}</CarouselContext>
		</div>
	);
}

Carousel.Track = CarouselTrack;
Carousel.Arrows = CarouselArrows;
Carousel.Dots = CarouselDots;
