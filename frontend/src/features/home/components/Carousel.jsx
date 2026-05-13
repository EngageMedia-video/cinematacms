import { createContext, use, useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '../../shared/components/Icon';
import { MediaTile } from './MediaTile';

const CarouselContext = createContext(null);

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

const DEFAULT_VISIBLE_COUNT = 4;
const RESPONSIVE_VISIBLE_COUNT_QUERIES = [
	{ query: '(max-width: 639px)', visibleCount: 1 },
	{ query: '(max-width: 1023px)', visibleCount: 2 },
];

// Must match gap-4 (1rem). Used in CSS calc expressions below.
const GAP_REM = 1;
const SWIPE_THRESHOLD_PX = 48;

function getResponsiveVisibleCount() {
	if ('undefined' === typeof window || !window.matchMedia) {
		return DEFAULT_VISIBLE_COUNT;
	}

	const match = RESPONSIVE_VISIBLE_COUNT_QUERIES.find(({ query }) => window.matchMedia(query).matches);
	return match?.visibleCount ?? DEFAULT_VISIBLE_COUNT;
}

function useCarouselVisibleCount(visibleCount) {
	const [responsiveVisibleCount, setResponsiveVisibleCount] = useState(
		() => visibleCount ?? getResponsiveVisibleCount()
	);

	useEffect(() => {
		if (visibleCount !== undefined) {
			setResponsiveVisibleCount(visibleCount);
			return undefined;
		}

		if ('undefined' === typeof window || !window.matchMedia) {
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
	}, [visibleCount]);

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
	const { items, visibleCount, currentPage, goPrev, goNext, atStart, atEnd } = use(CarouselContext);
	const swipeStartRef = useRef(null);
	const didSwipeRef = useRef(false);

	// N items + N-1 gaps = container.
	const itemWidth = `calc(${100 / visibleCount}% - ${(visibleCount - 1) / visibleCount}rem)`;

	// Translation per page = N × item width + N gaps = container + one gap.
	const translateX = `calc(-${currentPage} * (100% + ${GAP_REM}rem))`;

	const handlePointerDown = useCallback((event) => {
		if (event.pointerType === 'mouse' && event.button !== 0) {
			return;
		}

		swipeStartRef.current = { x: event.clientX, y: event.clientY };
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
			className="touch-pan-y overflow-hidden"
			data-carousel-track
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onClickCapture={handleClickCapture}
		>
			<div
				className="flex gap-4 transition-transform duration-300 ease-in-out"
				style={{ transform: `translateX(${translateX})` }}
			>
				{items.map((item) => (
					<div
						key={item.friendly_token ?? item.id ?? item.url}
						style={{ flexShrink: 0, flexGrow: 0, width: itemWidth }}
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

export function CarouselIndicator({ count, activeIndex, onSelect }) {
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
	const [internalPage, setInternalPage] = useState(defaultPage);
	const resolvedVisibleCount = useCarouselVisibleCount(visibleCount);
	const safeVisibleCount = Math.max(1, resolvedVisibleCount);

	const isControlled = controlledPage !== undefined;
	const currentPage = isControlled ? controlledPage : internalPage;
	const pageCount = Math.max(1, Math.ceil(items.length / safeVisibleCount));
	const safePage = clamp(currentPage, 0, pageCount - 1);
	const atStart = safePage === 0;
	const atEnd = safePage >= pageCount - 1;

	const goPrev = useCallback(() => {
		if (isControlled) {
			onPageChange?.(clamp(controlledPage - 1, 0, pageCount - 1));
		} else {
			setInternalPage((p) => clamp(p - 1, 0, pageCount - 1));
		}
	}, [isControlled, controlledPage, onPageChange, pageCount]);

	const goNext = useCallback(() => {
		if (isControlled) {
			onPageChange?.(clamp(controlledPage + 1, 0, pageCount - 1));
		} else {
			setInternalPage((p) => clamp(p + 1, 0, pageCount - 1));
		}
	}, [isControlled, controlledPage, onPageChange, pageCount]);

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

	const value = {
		items,
		visibleCount: safeVisibleCount,
		pageCount,
		currentPage: safePage,
		goPrev,
		goNext,
		goToPage,
		atStart,
		atEnd,
	};

	return <CarouselContext value={value}>{children ?? <DefaultCarouselBody />}</CarouselContext>;
}

Carousel.Track = CarouselTrack;
Carousel.Arrows = CarouselArrows;
Carousel.Dots = CarouselDots;
