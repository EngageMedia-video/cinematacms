import { createContext, use, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { Badge } from '../../shared/components/Badge';
import { Text } from '../../shared/components/Text';
import { ExpandableText } from './ExpandableText';
import { Carousel } from './Carousel';
import { CAROUSEL_GRID_TEMPLATE_COLUMNS } from './carouselLayout';
import { MediaTile } from './MediaTile';

const SectionRowContext = createContext(null);

const BACKGROUND_SECTION_CLASS = 'relative isolate py-4 sm:py-5';
const BACKGROUND_LAYER_CLASS =
	'pointer-events-none absolute inset-y-0 -left-4 -right-4 -z-10 bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-800 sm:-left-6 sm:-right-6 sm:rounded-[8px] lg:-left-8 lg:-right-8';

const VIEW_ALL_LINK_CLASS = 'whitespace-nowrap uppercase tracking-wide hover:text-text-link-hover';

const SKELETON_ITEMS = Array.from({ length: 4 }, (_, i) => i);
const GRID_CLASS = 'grid gap-x-4 gap-y-8';
const DYNAMIC_GRID_STYLE = {
	gridTemplateColumns: CAROUSEL_GRID_TEMPLATE_COLUMNS,
};

function ViewAllLink({ href }) {
	return (
		<Text
			as="a"
			action="text-link"
			variant="body-12-medium"
			color="sunset-horizon"
			href={href}
			className={VIEW_ALL_LINK_CLASS}
		>
			VIEW ALL
		</Text>
	);
}

function SectionRowHeader({ badgeLabel, badgeColor = 'var(--cinemata-strait-blue-500)', viewAllHref }) {
	return (
		<div className="flex items-center justify-between gap-4">
			{badgeLabel ? <Badge color={badgeColor}>{badgeLabel}</Badge> : null}
			{viewAllHref ? <ViewAllLink href={viewAllHref} /> : null}
		</div>
	);
}

function SectionRowTitle({ children, viewAllHref }) {
	const heading = <h2 className="heading-h6-20-medium m-0 text-text-primary">{children}</h2>;

	if (!viewAllHref) {
		return heading;
	}

	return (
		<div className="flex items-center justify-between gap-4">
			{heading}
			<ViewAllLink href={viewAllHref} />
		</div>
	);
}

function SectionRowDescription({ text }) {
	return <ExpandableText text={text} clampLines={2} className="body-body-14-regular text-text-secondary" />;
}

function SectionRowHtmlDescription({ html }) {
	const sanitized = useMemo(() => (html ? DOMPurify.sanitize(html) : ''), [html]);
	if (!sanitized) return null;

	return (
		<div
			className="body-body-14-regular space-y-2 text-text-secondary [&_a]:font-semibold [&_a]:text-text-link [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-text-link-hover [&_a:focus-visible]:outline [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-2 [&_a:focus-visible]:outline-ring-focus [&_br+br]:hidden [&_p]:m-0"
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
					<div className="aspect-video rounded-[6px] bg-bg-skeleton animate-pulse" />
					<div className="h-4 rounded bg-bg-skeleton animate-pulse w-3/4" />
					<div className="h-3 rounded bg-bg-skeleton animate-pulse w-1/2" />
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
				<div className="h-5 rounded bg-bg-skeleton animate-pulse w-32" />
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
