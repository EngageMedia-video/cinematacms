import PropTypes from 'prop-types';
import { useId, useMemo, useState } from 'react';
import { Button, Card, Icon } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { ImpactDetailDialog } from './ImpactDetailDialog';
import { getImpactIconConfig } from './impactIcons';
import { ImpactTimelineItem } from './ImpactTimelineItem';
import { formatImpactDate, formatRelativeImpactTime, getSafeHref } from './utils/formatDate';

function getSummaryEntry({ label, lastEventAt, lastReportedAt, totalCount, variant }) {
	if (variant === 'saves') {
		const saves = typeof totalCount === 'object' ? Number(totalCount?.saves) || 0 : Number(totalCount) || 0;
		const playlists = typeof totalCount === 'object' ? Number(totalCount?.playlists) || 0 : 0;

		return {
			date: lastEventAt,
			dateLabel: 'Last Saved',
			titleParts: playlists
				? [
						{ text: saves.toLocaleString(), accent: true },
						' saves in ',
						{ text: playlists.toLocaleString(), accent: true },
						' playlists',
					]
				: [{ text: saves.toLocaleString(), accent: true }, ' community saves and playlists'],
			url: '',
		};
	}

	const count = Number(totalCount) || 0;

	return {
		date: lastReportedAt,
		dateLabel: 'Last Reported',
		titleParts: ['Used in ', { text: count.toLocaleString(), accent: true }, ` ${label || 'academic contexts'}`],
		url: '',
	};
}

function renderTitle(entry) {
	if (Array.isArray(entry.titleParts)) {
		return entry.titleParts.map((part, index) => {
			if (typeof part === 'string') {
				return part;
			}

			return (
				<span key={`${part.text}-${index}`} className={part.accent ? 'text-text-accent' : undefined}>
					{part.text}
				</span>
			);
		});
	}

	return entry.title;
}

function ImpactMetaRow({ date, dateLabel = '', title, url }) {
	const safeHref = getSafeHref(url);
	const formattedDate = dateLabel ? formatRelativeImpactTime(date) || formatImpactDate(date) : formatImpactDate(date);
	const hasDateMeta = Boolean(dateLabel || formattedDate);

	return (
		<div className="mt-space-xs flex min-w-0 flex-wrap items-center gap-space-xs text-text-muted">
			{dateLabel ? <span className="body-body-12-regular text-text-muted">{dateLabel}</span> : null}
			{dateLabel && formattedDate ? (
				<span className="body-body-12-regular text-text-muted" aria-hidden="true">
					•
				</span>
			) : null}
			{formattedDate ? (
				<time className="body-body-12-regular" dateTime={date}>
					{formattedDate}
				</time>
			) : null}
			{safeHref && hasDateMeta ? (
				<span className="body-body-12-regular text-text-muted" aria-hidden="true">
					•
				</span>
			) : null}
			{safeHref ? (
				<a
					className="inline-flex shrink-0 items-center justify-center text-text-link outline-none hover:text-text-link-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
					href={safeHref}
					aria-label={`Open impact link for ${title}`}
					target="_blank"
					rel="noreferrer"
				>
					<Icon name="impactUrlLogo" size={20} decorative />
				</a>
			) : null}
		</div>
	);
}

export function ImpactCard({
	collapsedCount = 3,
	entries = [],
	label = '',
	lastEventAt = '',
	lastReportedAt = '',
	subtitle = '',
	title,
	totalCount,
	variant = 'screening',
}) {
	const [modalOpen, setModalOpen] = useState(false);
	const contentId = useId();
	const config = getImpactIconConfig(variant);
	const isSummary = variant === 'saves' || variant === 'academic';
	const categoryLabel = title || config.label;
	const previewEntries = useMemo(
		() => (isSummary ? [getSummaryEntry({ label, lastEventAt, lastReportedAt, totalCount, variant })] : entries),
		[entries, isSummary, label, lastEventAt, lastReportedAt, totalCount, variant]
	);
	const shouldScroll = previewEntries.length > collapsedCount;
	const visibleEntries = previewEntries;
	const [firstEntry, ...remainingEntries] = visibleEntries;
	const firstTitleText = firstEntry?.title || firstEntry?.titleParts?.map((part) => part.text || part).join('') || '';

	return (
		<Card
			variant="outlined"
			className="relative flex flex-col rounded-ds-8 border-border-default p-space-base"
			aria-label={categoryLabel}
		>
			<Button
				variant="icon"
				className="absolute top-space-base right-space-base z-10 h-size-32 w-size-32 shrink-0 text-text-muted outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring-focus"
				aria-haspopup="dialog"
				aria-label={`Open ${categoryLabel} details`}
				onClick={() => setModalOpen(true)}
				icon={<Icon name="arrowsOutSimple" size="sm" decorative />}
			/>

			<div id={contentId} className="min-h-0 flex-1">
				{firstEntry ? (
					<ul
						className={cn(
							'm-0 list-none p-0 pr-space-xs',
							shouldScroll && 'max-h-[calc(var(--size-96)*3+var(--size-80))] overflow-y-auto'
						)}
					>
						<li className="relative grid min-h-[80px] grid-cols-[var(--size-32)_1fr] gap-space-sm">
							<span className="relative flex justify-center" aria-hidden="true">
								<span className="absolute top-[38px] h-[42px] w-px bg-border-default" />
								<span
									className={cn(
										'relative z-10 inline-flex h-size-32 w-size-32 shrink-0 items-center justify-center rounded-full',
										config.iconShellClassName
									)}
								>
									<Icon name={config.iconName} size="sm" decorative />
								</span>
							</span>
							<div className="min-w-0 pr-size-40">
								<p className="body-body-12-regular m-0 text-text-muted">{categoryLabel}</p>
								<p
									id={`${contentId}-title`}
									className="body-body-14-bold m-0 mt-space-xs break-words text-text-primary"
								>
									{renderTitle(firstEntry)}
								</p>
								<ImpactMetaRow
									date={firstEntry.date}
									dateLabel={firstEntry.dateLabel}
									title={firstTitleText}
									url={firstEntry.url}
								/>
							</div>
						</li>
						{remainingEntries.map((entry, index) => (
							<ImpactTimelineItem
								key={`${entry.title}-${entry.date}-${index}`}
								date={entry.date}
								title={entry.title}
								url={entry.url}
							/>
						))}
					</ul>
				) : null}
			</div>

			<ImpactDetailDialog
				entries={entries}
				onClose={() => setModalOpen(false)}
				open={modalOpen}
				subtitle={subtitle}
				title={categoryLabel}
				variant={variant}
			/>
		</Card>
	);
}

ImpactMetaRow.propTypes = {
	date: PropTypes.string,
	dateLabel: PropTypes.string,
	title: PropTypes.string,
	url: PropTypes.string,
};

const entryShape = PropTypes.shape({
	date: PropTypes.string,
	meta: PropTypes.string,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
	value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
});

ImpactCard.propTypes = {
	collapsedCount: PropTypes.number,
	entries: PropTypes.arrayOf(entryShape),
	label: PropTypes.string,
	lastEventAt: PropTypes.string,
	lastReportedAt: PropTypes.string,
	subtitle: PropTypes.string,
	title: PropTypes.string,
	totalCount: PropTypes.oneOfType([
		PropTypes.number,
		PropTypes.shape({
			playlists: PropTypes.number,
			saves: PropTypes.number,
		}),
	]),
	variant: PropTypes.oneOf(['screening', 'featured', 'saves', 'academic', 'curated']),
};
