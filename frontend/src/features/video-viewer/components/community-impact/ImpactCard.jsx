import PropTypes from 'prop-types';
import { useId, useMemo, useState } from 'react';
import { Button, Card, Icon, Text } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { getImpactIconConfig } from './impactIcons';
import { ImpactTimelineItem } from './ImpactTimelineItem';
import { formatImpactDate } from './utils/formatDate';

function getTotalCount(totalCount) {
	if (typeof totalCount === 'number') {
		return totalCount;
	}

	if (!totalCount || typeof totalCount !== 'object') {
		return 0;
	}

	return Object.values(totalCount).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function getSummaryRows({ entries, label, lastEventAt, lastReportedAt, totalCount, variant }) {
	if (entries?.length) {
		const [latestEntry] = entries;
		return [
			{
				label: label || (variant === 'academic' ? 'Academic references' : 'Community saves and playlists'),
				value: entries.length.toLocaleString(),
				meta: entries.length === 1 ? 'Reported use' : 'Reported uses',
			},
			latestEntry && {
				label: 'Latest activity',
				value: formatImpactDate(latestEntry.date),
				meta: latestEntry.title,
			},
		].filter(Boolean);
	}

	if (variant === 'saves') {
		const saves = Number(totalCount?.saves) || 0;
		const playlists = Number(totalCount?.playlists) || 0;

		return [
			{
				label: 'Saved by viewers',
				value: saves.toLocaleString(),
				meta: 'Saves',
			},
			{
				label: 'Added to playlists',
				value: playlists.toLocaleString(),
				meta: 'Playlists',
			},
			{
				label: 'Last activity',
				value: formatImpactDate(lastEventAt),
				meta: 'Latest community signal',
			},
		].filter((row) => row.value);
	}

	const count = Number(totalCount) || 0;

	return [
		{
			label: label || 'Academic references',
			value: count.toLocaleString(),
			meta: 'Reported uses',
		},
		{
			label: 'Last reported',
			value: formatImpactDate(lastReportedAt),
			meta: 'Latest academic signal',
		},
	].filter((row) => row.value);
}

export function ImpactCard({
	collapsedCount = 2,
	defaultExpanded = false,
	entries = [],
	label = '',
	lastEventAt = '',
	lastReportedAt = '',
	subtitle,
	title,
	totalCount,
	variant = 'screening',
}) {
	const [expanded, setExpanded] = useState(defaultExpanded);
	const contentId = useId();
	const config = getImpactIconConfig(variant);
	const isSummary = variant === 'saves' || variant === 'academic';
	const visibleEntries = expanded ? entries : entries.slice(0, collapsedCount);
	const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);
	const canToggle = !isSummary && entries.length > collapsedCount;
	const computedSubtitle =
		subtitle ??
		(isSummary
			? `${getTotalCount(totalCount).toLocaleString()} community signals`
			: `${entries.length.toLocaleString()} reported ${entries.length === 1 ? 'entry' : 'entries'}`);
	const summaryRows = useMemo(
		() => getSummaryRows({ entries, label, lastEventAt, lastReportedAt, totalCount, variant }),
		[entries, label, lastEventAt, lastReportedAt, totalCount, variant]
	);

	return (
		<Card
			variant="outlined"
			className="flex min-h-[calc(var(--size-96)*2+var(--size-48))] flex-col rounded-ds-8 border-border-default p-space-lg"
			aria-labelledby={`${contentId}-title`}
		>
			<div className="flex items-start justify-between gap-space-base">
				<div className="flex min-w-0 items-start gap-space-sm">
					<span
						className={cn(
							'inline-flex h-size-40 w-size-40 shrink-0 items-center justify-center rounded-ds-4',
							config.iconShellClassName
						)}
						aria-hidden="true"
					>
						<Icon name={config.iconName} size="md" decorative />
					</span>
					<div className="min-w-0">
						<Text
							id={`${contentId}-title`}
							variant="h6-medium"
							as="h3"
							className="m-0 break-words text-text-primary"
						>
							{title || config.label}
						</Text>
						<Text variant="body-12" color="meta" className="m-0 mt-space-2">
							{computedSubtitle}
						</Text>
					</div>
				</div>

				{canToggle ? (
					<Button
						variant="icon"
						className="h-size-32 w-size-32 shrink-0 rounded-full text-text-muted outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring-focus"
						aria-controls={contentId}
						aria-expanded={expanded}
						aria-label={
							expanded
								? `Show fewer ${title || config.label} entries`
								: `Show all ${title || config.label} entries`
						}
						onClick={() => setExpanded((current) => !current)}
						icon={
							<Icon
								name="chevronDown"
								size="sm"
								decorative
								className={cn('transition-transform duration-200', expanded ? 'rotate-180' : '')}
							/>
						}
					/>
				) : null}
			</div>

			<div id={contentId} className="mt-space-lg min-h-0 flex-1">
				{isSummary ? (
					<ul className="m-0 grid list-none gap-space-sm p-0">
						{summaryRows.map((row) => (
							<li
								key={`${row.label}-${row.value}`}
								className="rounded-ds-4 border border-border-default bg-bg-surface-muted p-space-sm"
							>
								<p className="body-body-18-bold m-0 text-text-primary">{row.value}</p>
								<p className="body-body-14-bold m-0 mt-space-2 text-text-primary">{row.label}</p>
								{row.meta ? (
									<p className="body-body-12-regular m-0 mt-space-2 text-text-muted">{row.meta}</p>
								) : null}
							</li>
						))}
					</ul>
				) : (
					<ul
						className={cn(
							'm-0 list-none overflow-y-auto p-0 pr-space-xs',
							expanded && entries.length > 5
								? 'max-h-[calc(var(--size-96)*3+var(--size-64)+var(--size-8))]'
								: ''
						)}
					>
						{visibleEntries.map((entry, index) => (
							<ImpactTimelineItem
								key={`${entry.title}-${entry.date}-${index}`}
								accentClassName={config.accentClassName}
								date={entry.date}
								isFirst={index === 0}
								isLast={index === visibleEntries.length - 1}
								title={entry.title}
								url={entry.url}
							/>
						))}
					</ul>
				)}
			</div>

			{canToggle && hiddenCount > 0 ? (
				<Text variant="body-12" color="meta" className="m-0 mt-space-sm">
					{hiddenCount} more {hiddenCount === 1 ? 'entry' : 'entries'}
				</Text>
			) : null}
		</Card>
	);
}

const entryShape = PropTypes.shape({
	date: PropTypes.string,
	meta: PropTypes.string,
	title: PropTypes.string.isRequired,
	url: PropTypes.string,
	value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
});

ImpactCard.propTypes = {
	collapsedCount: PropTypes.number,
	defaultExpanded: PropTypes.bool,
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
