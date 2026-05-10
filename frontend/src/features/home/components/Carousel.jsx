import { createContext, use, useState, useCallback } from 'react';
import { formatDuration } from '../../shared/utils/formatDuration';
import { VerticalMovieItem } from '../../shared/components/MovieItem/MovieItem';

const CarouselContext = createContext(null);

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

const DEFAULT_VISIBLE_COUNT = 4;

function CarouselTrack() {
	const { items, visibleCount, currentPage } = use(CarouselContext);
	const start = currentPage * visibleCount;
	const visible = items.slice(start, start + visibleCount);

	return (
		<div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visibleCount}, minmax(0, 1fr))` }}>
			{visible.map((item) => (
				<VerticalMovieItem
					key={item.friendly_token ?? item.id ?? item.url}
					title={item.title}
					imageSrc={item.thumbnail_url}
					link={item.url}
					duration={item.duration_in_seconds ? formatDuration(item.duration_in_seconds) : ''}
					subtitle={item.author_name}
				/>
			))}
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

function CarouselDots() {
	const { pageCount, currentPage, goToPage } = use(CarouselContext);

	return (
		<div className="flex items-center gap-1" role="group" aria-label="Page navigation">
			{Array.from({ length: pageCount }, (_, i) => (
				<button
					key={i}
					type="button"
					onClick={() => goToPage(i)}
					aria-label={`Go to page ${i + 1}`}
					aria-current={i === currentPage ? 'true' : undefined}
					className={`h-2 w-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200 ${
						i === currentPage
							? 'bg-cinemata-strait-blue-50'
							: 'bg-cinemata-pacific-deep-600 hover:bg-cinemata-pacific-deep-400'
					}`}
				/>
			))}
		</div>
	);
}

function DefaultCarouselBody() {
	return (
		<>
			<CarouselTrack />
			<div className="flex items-center justify-between mt-3">
				<CarouselDots />
				<CarouselArrows />
			</div>
		</>
	);
}

export function Carousel({
	items = [],
	visibleCount = DEFAULT_VISIBLE_COUNT,
	currentPage: controlledPage,
	onPageChange,
	defaultPage = 0,
	children,
}) {
	const [internalPage, setInternalPage] = useState(defaultPage);

	const isControlled = controlledPage !== undefined;
	const currentPage = isControlled ? controlledPage : internalPage;
	const pageCount = Math.max(1, Math.ceil(items.length / visibleCount));
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

	const value = { items, visibleCount, pageCount, currentPage: safePage, goPrev, goNext, goToPage, atStart, atEnd };

	return <CarouselContext value={value}>{children ?? <DefaultCarouselBody />}</CarouselContext>;
}

Carousel.Track = CarouselTrack;
Carousel.Arrows = CarouselArrows;
Carousel.Dots = CarouselDots;
