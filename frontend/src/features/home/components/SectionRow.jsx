import { createContext, use } from 'react';
import { Badge } from '../../shared/components/Badge';
import { ExpandableText } from './ExpandableText';
import { Carousel } from './Carousel';

const SectionRowContext = createContext(null);

const CARD_SECTION_CLASS = 'rounded-xl bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800 p-6';

const SKELETON_ITEMS = Array.from({ length: 4 }, (_, i) => i);

function SectionRowHeader({ badgeLabel, badgeColor = '#026690', viewAllHref }) {
	return (
		<div className="flex items-center justify-between gap-4">
			{badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}
			{viewAllHref ? (
				<a
					href={viewAllHref}
					className="caption-caption-10-regular text-cinemata-strait-blue-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200 uppercase tracking-wide"
				>
					VIEW ALL
				</a>
			) : null}
		</div>
	);
}

function SectionRowTitle({ children, viewAllHref }) {
	if (viewAllHref) {
		return (
			<div className="flex items-center justify-between gap-4">
				<h2 className="heading-h6-20-medium m-0 text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
					{children}
				</h2>
				<a
					href={viewAllHref}
					className="caption-caption-10-regular whitespace-nowrap uppercase tracking-wide text-cinemata-strait-blue-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200"
				>
					VIEW ALL
				</a>
			</div>
		);
	}
	return (
		<h2 className="heading-h6-20-medium m-0 text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
			{children}
		</h2>
	);
}

function SectionRowDescription({ text }) {
	return (
		<ExpandableText
			text={text}
			clampLines={2}
			className="body-body-14-regular text-cinemata-neutral-700 dark:text-cinemata-strait-blue-100"
		/>
	);
}

function SectionRowCarousel() {
	const { items } = use(SectionRowContext);
	return <Carousel items={items} />;
}

function SkeletonGrid() {
	return (
		<div className="grid gap-4 grid-cols-4">
			{SKELETON_ITEMS.map((i) => (
				<div key={i} className="flex flex-col gap-2">
					<div className="aspect-video rounded-[6px] bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-700 animate-pulse" />
					<div className="h-4 rounded bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-700 animate-pulse w-3/4" />
					<div className="h-3 rounded bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-700 animate-pulse w-1/2" />
				</div>
			))}
		</div>
	);
}

export function SectionRow({ items = [], isLoading = false, isError = false, variant = 'default', children }) {
	const isEmpty = !isLoading && items.length === 0;

	if (isError || isEmpty) {
		return null;
	}

	const sectionClass = variant === 'card' ? `${CARD_SECTION_CLASS} flex flex-col gap-4` : 'flex flex-col gap-4';

	if (isLoading) {
		return (
			<section className={sectionClass}>
				<div className="h-5 rounded bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-700 animate-pulse w-32" />
				<SkeletonGrid />
			</section>
		);
	}

	const value = { items, variant };

	return (
		<SectionRowContext value={value}>
			<section className={sectionClass}>{children}</section>
		</SectionRowContext>
	);
}

SectionRow.Header = SectionRowHeader;
SectionRow.Title = SectionRowTitle;
SectionRow.Description = SectionRowDescription;
SectionRow.Carousel = SectionRowCarousel;
