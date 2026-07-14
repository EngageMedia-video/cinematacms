import { Icon, Text } from '../../../shared/components';
import { getImpactIconConfig } from '../../../video-viewer/components/community-impact/impactIcons';
import { formatImpactDate, getSafeHref } from '../../../video-viewer/components/community-impact/utils/formatDate';
import { ImpactFilmRow } from './ImpactFilmRow';

// Categories shown as labelled rows beneath each film, in the order the ticket
// wireframe specifies. "saves" is a summary-only category and "curated" is
// excluded server-side, so neither appears here. Icons/labels reuse the media
// page's impact config so the two surfaces stay visually consistent.
const CATEGORY_KEYS = ['screening', 'featured', 'academic'];

function entryList(bucket) {
	if (Array.isArray(bucket)) return bucket;
	return Array.isArray(bucket?.entries) ? bucket.entries : [];
}

function ImpactEntry({ entry }) {
	const href = getSafeHref(entry?.url);
	const date = formatImpactDate(entry?.event_date || entry?.add_date);
	const title = entry?.title || '';

	return (
		<li className="flex min-w-0 flex-col gap-1 border-b border-border-divider py-3 last:border-b-0">
			{href ? (
				<a
					href={href}
					target="_blank"
					rel="noreferrer"
					className="w-fit text-text-primary no-underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus body-body-14-medium"
				>
					{title}
				</a>
			) : (
				<span className="text-text-primary body-body-14-medium">{title}</span>
			)}
			{entry?.details ? (
				<p className="m-0 break-words text-text-muted body-body-12-regular">{entry.details}</p>
			) : null}
			{date ? (
				<time className="text-text-muted body-body-12-regular" dateTime={entry?.event_date || entry?.add_date}>
					{date}
				</time>
			) : null}
		</li>
	);
}

function CategoryRow({ categoryKey, entries }) {
	const config = getImpactIconConfig(categoryKey);

	return (
		<section className="rounded-lg bg-bg-surface-muted p-4">
			<div className="flex items-center gap-3">
				<span
					className={`inline-flex h-size-32 w-size-32 shrink-0 items-center justify-center rounded-full ${config.iconShellClassName}`}
					aria-hidden="true"
				>
					<Icon name={config.iconName} size="sm" decorative />
				</span>
				<Text as="h4" variant="body-12-medium" className="m-0 text-text-muted uppercase">
					{config.label}
				</Text>
			</div>
			<ul className="mt-2 flex list-none flex-col p-0">
				{entries.map((entry, index) => (
					<ImpactEntry key={entry?.uid || index} entry={entry} />
				))}
			</ul>
		</section>
	);
}

export function ImpactFilmGroup({ film, index = 0 }) {
	const impact = film?.impact || {};
	const rows = CATEGORY_KEYS.map((key) => ({ key, entries: entryList(impact[key]) })).filter(
		(row) => row.entries.length > 0
	);

	if (!rows.length) return null;

	return (
		<section className="flex flex-col gap-4 rounded-lg border border-border-default p-4">
			<ImpactFilmRow media={film.media} index={index} />
			<div className="flex flex-col gap-3">
				{rows.map((row) => (
					<CategoryRow key={row.key} categoryKey={row.key} entries={row.entries} />
				))}
			</div>
		</section>
	);
}
