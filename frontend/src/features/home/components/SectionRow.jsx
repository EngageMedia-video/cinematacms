import { createContext, use } from 'react';
import { Badge } from '../../shared/components/Badge';
import { ExpandableText } from './ExpandableText';
import { Carousel } from './Carousel';

const SectionRowContext = createContext(null);

const SKELETON_ITEMS = Array.from({ length: 4 }, (_, i) => i);

function SectionRowHeader({ badgeLabel, badgeColor = '#026690', viewAllHref }) {
	return (
		<div className="flex items-center justify-between gap-4">
			{badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}
			{viewAllHref ? (
				<a
					href={viewAllHref}
					rel="noopener noreferrer"
					className="caption-caption-10-regular text-cinemata-strait-blue-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-strait-blue-200 uppercase tracking-wide"
				>
					VIEW ALL
				</a>
			) : null}
		</div>
	);
}

function SectionRowDescription({ text }) {
	return (
		<ExpandableText text={text} clampLines={2} className="text-cinemata-pacific-deep-400 body-body-14-regular" />
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
					<div className="aspect-video rounded-[6px] bg-cinemata-pacific-deep-800 animate-pulse" />
					<div className="h-4 rounded bg-cinemata-pacific-deep-800 animate-pulse w-3/4" />
					<div className="h-3 rounded bg-cinemata-pacific-deep-800 animate-pulse w-1/2" />
				</div>
			))}
		</div>
	);
}

export function SectionRow({ items = [], isLoading = false, isError = false, children }) {
	const isEmpty = !isLoading && items.length === 0;

	if (isError || isEmpty) {
		return null;
	}

	if (isLoading) {
		return (
			<section className="flex flex-col gap-4">
				<div className="h-5 rounded bg-cinemata-pacific-deep-800 animate-pulse w-32" />
				<SkeletonGrid />
			</section>
		);
	}

	const value = { items };

	return (
		<SectionRowContext value={value}>
			<section className="flex flex-col gap-4">{children}</section>
		</SectionRowContext>
	);
}

SectionRow.Header = SectionRowHeader;
SectionRow.Description = SectionRowDescription;
SectionRow.Carousel = SectionRowCarousel;
