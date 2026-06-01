import PropTypes from 'prop-types';
import { Button, Dialog, DialogContent, Icon, Text } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { ImpactTimelineItem } from './ImpactTimelineItem';
import { getImpactIconConfig } from './impactIcons';
import { formatImpactDate, getSafeHref } from './utils/formatDate';

export function ImpactDetailDialog({ entries = [], onClose, open = false, subtitle, title, variant = 'screening' }) {
	const config = getImpactIconConfig(variant);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					onClose?.();
				}
			}}
		>
			<DialogContent
				aria-label={title}
				className="flex max-h-[calc(100vh-var(--size-64))] w-full max-w-[calc(var(--size-96)*5+var(--size-40))] flex-col overflow-hidden rounded-ds-8 border border-border-default bg-bg-surface p-space-lg shadow-lg"
			>
				<div className="flex items-start justify-between gap-space-base">
					<div className="min-w-0">
						<Text variant="h5-bold" as="h2" className="m-0 text-text-primary">
							{title}
						</Text>
						{subtitle ? (
							<Text variant="body-14" color="meta" className="m-0 mt-space-xs">
								{subtitle}
							</Text>
						) : null}
					</div>
					<Button
						variant="icon"
						className="h-size-40 w-size-40 shrink-0 rounded-full bg-bg-impact-modal-close text-text-impact-modal-close outline-none hover:bg-bg-impact-modal-close focus-visible:ring-2 focus-visible:ring-ring-focus"
						aria-label={`Close ${title} details`}
						onClick={onClose}
						icon={<Icon name="arrowsInDiagonal" size="sm" decorative />}
					/>
				</div>

				<ul className="m-0 mt-space-lg max-h-full list-none overflow-y-auto p-0">
					<li className="relative grid min-h-[80px] grid-cols-[var(--size-32)_1fr] gap-space-sm">
						<span className="relative flex justify-center" aria-hidden="true">
							{entries.length > 1 ? (
								<span className="absolute top-[38px] h-[42px] w-px bg-border-default" />
							) : null}
							<span
								className={cn(
									'relative z-10 inline-flex h-size-32 w-size-32 shrink-0 items-center justify-center rounded-full',
									config.iconShellClassName
								)}
							>
								<Icon name={config.iconName} size="sm" decorative />
							</span>
						</span>
						<div className="min-w-0">
							<p className="body-body-12-regular m-0 text-text-muted">{config.label}</p>
							{entries[0] ? (
								<>
									<p className="body-body-14-bold m-0 mt-space-xs break-words text-text-primary">
										{entries[0].title}
									</p>
									<TimelineMeta
										date={entries[0].date}
										title={entries[0].title}
										url={entries[0].url}
									/>
								</>
							) : null}
						</div>
					</li>
					{entries.slice(1).map((entry, index) => (
						<ImpactTimelineItem
							key={`${entry.title}-${entry.date}-${index}`}
							date={entry.date}
							title={entry.title}
							url={entry.url}
						/>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}

function TimelineMeta({ date, title, url }) {
	const formattedDate = formatImpactDate(date);
	const safeHref = getSafeHref(url);

	if (!formattedDate && !safeHref) {
		return null;
	}

	return (
		<div className="mt-space-xs flex min-w-0 flex-wrap items-center gap-space-xs text-text-muted">
			{formattedDate ? (
				<time className="body-body-12-regular" dateTime={date}>
					{formattedDate}
				</time>
			) : null}
			{formattedDate && safeHref ? (
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

TimelineMeta.propTypes = {
	date: PropTypes.string,
	title: PropTypes.string,
	url: PropTypes.string,
};

ImpactDetailDialog.propTypes = {
	entries: PropTypes.arrayOf(
		PropTypes.shape({
			date: PropTypes.string,
			title: PropTypes.string,
			url: PropTypes.string,
		})
	),
	onClose: PropTypes.func,
	open: PropTypes.bool,
	subtitle: PropTypes.string,
	title: PropTypes.string,
	variant: PropTypes.string,
};
