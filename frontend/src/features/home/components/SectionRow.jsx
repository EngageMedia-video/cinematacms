import { createContext, use, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Badge } from '../../shared/components/Badge';
import { ExpandableText } from './ExpandableText';
import { Carousel } from './Carousel';
import { CAROUSEL_GRID_TEMPLATE_COLUMNS } from './carouselLayout';
import { MediaTile } from './MediaTile';

const SectionRowContext = createContext(null);

const BACKGROUND_SECTION_CLASS = 'relative isolate py-4 sm:py-5';
const BACKGROUND_LAYER_CLASS =
	'pointer-events-none absolute inset-y-0 -left-4 -right-4 -z-10 bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-800 sm:-left-6 sm:-right-6 sm:rounded-[8px] lg:-left-8 lg:-right-8';

const VIEW_ALL_LINK_CLASS =
	'caption-caption-10-regular whitespace-nowrap uppercase tracking-wide text-cinemata-sunset-horizon-400p no-underline hover:text-cinemata-sunset-horizon-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-200 dark:hover:text-cinemata-sunset-horizon-100';

const SKELETON_ITEMS = Array.from({ length: 4 }, (_, i) => i);
const GRID_CLASS = 'grid gap-x-4 gap-y-8';
const DYNAMIC_GRID_STYLE = {
	gridTemplateColumns: CAROUSEL_GRID_TEMPLATE_COLUMNS,
};

function SectionRowHeader({ badgeLabel, badgeColor = '#026690', viewAllHref }) {
	return (
		<div className="flex items-center justify-between gap-4">
			{badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}
			{viewAllHref ? (
				<a href={viewAllHref} className={VIEW_ALL_LINK_CLASS}>
					VIEW ALL
				</a>
			) : null}
		</div>
	);
}

function SectionRowTitle({ children, viewAllHref }) {
	const heading = (
		<h2 className="heading-h6-20-medium m-0 text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50">
			{children}
		</h2>
	);

	if (!viewAllHref) {
		return heading;
	}

	return (
		<div className="flex items-center justify-between gap-4">
			{heading}
			<a href={viewAllHref} className={VIEW_ALL_LINK_CLASS}>
				VIEW ALL
			</a>
		</div>
	);
}

function SectionRowDescription({ text }) {
	return (
		<ExpandableText
			text={text}
			clampLines={2}
			className="body-body-14-regular text-cinemata-strait-blue-700 dark:text-cinemata-strait-blue-100"
		/>
	);
}

function SectionRowHtmlDescription({ html }) {
	const sanitized = useMemo(() => (html ? DOMPurify.sanitize(html) : ''), [html]);
	if (!sanitized) return null;

	return (
		<div
			className="body-body-14-regular space-y-2 text-cinemata-strait-blue-700 dark:text-cinemata-strait-blue-100 [&_a]:font-semibold [&_a]:text-cinemata-sunset-horizon-400p [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-cinemata-sunset-horizon-600 [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-cinemata-sunset-horizon-400p [&_br+br]:hidden [&_p]:m-0 dark:[&_a]:text-cinemata-sunset-horizon-200 dark:[&_a:hover]:text-cinemata-sunset-horizon-100"
			dangerouslySetInnerHTML={{ __html: sanitized }}
		/>
	);
}

function SectionRowCarousel() {
	const { items } = use(SectionRowContext);
	return <Carousel items={items} />;
}

function SectionRowGrid() {
	const { items } = use(SectionRowContext);

	return (
		<div className={GRID_CLASS} style={DYNAMIC_GRID_STYLE} data-section-row-grid>
			{items.map((item) => (
				<MediaTile key={item.friendly_token ?? item.id ?? item.url} item={item} />
			))}
		</div>
	);
}

function SkeletonGrid() {
	return (
		<div className={GRID_CLASS} style={DYNAMIC_GRID_STYLE}>
			{SKELETON_ITEMS.map((i) => (
				<div key={i} className="flex flex-col gap-2">
					<div className="aspect-video rounded-[6px] bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-700 animate-pulse" />
					<div className="h-4 rounded bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-700 animate-pulse w-3/4" />
					<div className="h-3 rounded bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-700 animate-pulse w-1/2" />
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

	const sectionClass = variant === 'card' ? `${BACKGROUND_SECTION_CLASS} flex flex-col gap-4` : 'flex flex-col gap-4';

	if (isLoading) {
		return (
			<section className={sectionClass}>
				{variant === 'card' ? <div aria-hidden="true" className={BACKGROUND_LAYER_CLASS} /> : null}
				<div className="h-5 rounded bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-700 animate-pulse w-32" />
				<SkeletonGrid />
			</section>
		);
	}

	const value = useMemo(() => ({ items, variant }), [items, variant]);

	return (
		<SectionRowContext value={value}>
			<section className={sectionClass}>
				{variant === 'card' ? <div aria-hidden="true" className={BACKGROUND_LAYER_CLASS} /> : null}
				{children}
			</section>
		</SectionRowContext>
	);
}

SectionRow.Header = SectionRowHeader;
SectionRow.Title = SectionRowTitle;
SectionRow.Description = SectionRowDescription;
SectionRow.HtmlDescription = SectionRowHtmlDescription;
SectionRow.Carousel = SectionRowCarousel;
SectionRow.Grid = SectionRowGrid;
