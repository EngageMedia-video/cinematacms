import PropTypes from 'prop-types';
import { useState } from 'react';
import { Card, Icon } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { ImpactDetailDialog } from './ImpactDetailDialog';
import { LIST_CARD_PREVIEW_COUNT } from './utils/buildImpactCards';
import { formatImpactMonthYear, getSafeHref } from './utils/formatDate';

function ImpactCardEntry({ entry }) {
	const safeHref = getSafeHref(entry.url);
	const when = entry.year ? String(entry.year) : formatImpactMonthYear(entry.date);
	const dateTime = entry.year ? String(entry.year) : entry.date;

	return (
		<li className="flex min-w-0 flex-col gap-2">
			<p className="body-body-16-regular m-0 wrap-break-word text-text-strong">{entry.title}</p>
			{when || safeHref ? (
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-text-description">
					{when ? (
						<time className="body-body-14-regular" dateTime={dateTime}>
							{when}
						</time>
					) : null}
					{when && safeHref ? (
						<span className="body-body-14-regular" aria-hidden="true">
							•
						</span>
					) : null}
					{safeHref ? (
						<a
							className="pointer-events-auto relative inline-flex shrink-0 items-center justify-center text-text-accent outline-none hover:text-text-link-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
							href={safeHref}
							aria-label={`Open impact link for ${entry.title}`}
							target="_blank"
							rel="noreferrer"
						>
							<Icon name="impactUrlLogo" size={20} decorative />
						</a>
					) : null}
				</div>
			) : null}
		</li>
	);
}

const entryShape = PropTypes.shape({
	date: PropTypes.string,
	summary: PropTypes.string,
	title: PropTypes.string.isRequired,
	uid: PropTypes.string,
	url: PropTypes.string,
	year: PropTypes.number,
});

ImpactCardEntry.propTypes = {
	entry: entryShape.isRequired,
};

export function ImpactCard({
	entries = [],
	iconName,
	iconShellClassName = '',
	label,
	layout = 'list',
	subtitle = '',
	value = '',
	variant,
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const isSummary = layout === 'summary';
	const previewEntries = isSummary ? [] : entries.slice(0, LIST_CARD_PREVIEW_COUNT);

	return (
		<Card
			aria-label={label}
			className={cn(
				'relative flex gap-4 rounded-ds-8 border border-border-divider p-4',
				isSummary ? 'self-start' : ''
			)}
		>
			{/* Covers the card so a click anywhere opens the details; content sits above it. */}
			<button
				type="button"
				aria-haspopup="dialog"
				aria-label={`Open ${label} details`}
				onClick={() => setDialogOpen(true)}
				className="absolute inset-0 cursor-pointer rounded-ds-8 border-0 bg-transparent p-0 outline-none transition-colors duration-200 hover:bg-bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
			/>

			<span
				className={cn(
					'pointer-events-none relative inline-flex size-8 shrink-0 items-center justify-center rounded-full',
					iconShellClassName
				)}
				aria-hidden="true"
			>
				<Icon name={iconName} size={18} decorative />
			</span>

			<div
				className={cn(
					'pointer-events-none relative flex min-w-0 flex-1 flex-col',
					isSummary ? 'gap-2' : 'gap-3'
				)}
			>
				<p className="body-body-14-regular m-0 text-text-description">{label}</p>
				{isSummary ? (
					<p className="body-body-16-regular m-0 wrap-break-word text-text-strong">{value}</p>
				) : (
					<ul className="m-0 flex list-none flex-col gap-4.5 p-0">
						{previewEntries.map((entry, index) => (
							<ImpactCardEntry key={entry.uid ?? `${entry.title}-${index}`} entry={entry} />
						))}
					</ul>
				)}
			</div>

			<ImpactDetailDialog
				entries={entries}
				onClose={() => setDialogOpen(false)}
				open={dialogOpen}
				subtitle={subtitle}
				title={label}
				variant={variant}
			/>
		</Card>
	);
}

ImpactCard.propTypes = {
	entries: PropTypes.arrayOf(entryShape),
	iconName: PropTypes.string.isRequired,
	iconShellClassName: PropTypes.string,
	label: PropTypes.string.isRequired,
	layout: PropTypes.oneOf(['summary', 'list']),
	subtitle: PropTypes.string,
	value: PropTypes.string,
	variant: PropTypes.oneOf(['saves', 'academic', 'award', 'screening', 'article', 'referenced']).isRequired,
};
