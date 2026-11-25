import PropTypes from 'prop-types';
import { useId } from 'react';
import { Button, Icon } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { getImpactIconConfig } from './impactIcons';
import { formatRelativeImpactTime } from './utils/formatDate';

// Entries a group shows before VIEW ALL.
export const IMPACT_GROUP_PREVIEW_COUNT = 3;

export function ImpactGroup({
	children,
	count,
	expanded = false,
	iconKey,
	onToggleExpanded,
	showToggle = false,
	title,
}) {
	const headingId = useId();
	const listId = useId();
	const config = getImpactIconConfig(iconKey);

	return (
		<section
			aria-labelledby={headingId}
			className="box-border flex w-full flex-col rounded-ds-8 border border-solid border-border-divider p-4"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span
						aria-hidden="true"
						className={cn(
							'inline-flex size-8 shrink-0 items-center justify-center rounded-full',
							config.iconShellClassName
						)}
					>
						<Icon name={config.iconName} size={18} decorative />
					</span>
					<div className="flex min-w-0 items-center gap-2">
						<h3 id={headingId} className="body-body-14-medium m-0 uppercase text-text-secondary">
							{title}
						</h3>
						<span className="caption-caption-10-semibold inline-flex h-[18px] min-w-[23px] shrink-0 items-center justify-center rounded-full bg-bg-count px-1.5 text-text-on-count">
							{count.toLocaleString()}
						</span>
					</div>
				</div>
				{showToggle ? (
					<Button
						variant="text"
						className="shrink-0 px-2 py-2 text-text-accent hover:text-text-link-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
						aria-controls={listId}
						aria-expanded={expanded}
						onClick={onToggleExpanded}
					>
						{expanded ? 'VIEW LESS' : 'VIEW ALL'}
					</Button>
				) : null}
			</div>
			<div aria-hidden="true" className="my-[7.5px] h-px w-full bg-border-divider" />
			<ul id={listId} className="m-0 flex list-none flex-col gap-3 p-0 sm:pl-[30px]">
				{children}
			</ul>
		</section>
	);
}

ImpactGroup.propTypes = {
	children: PropTypes.node,
	count: PropTypes.number.isRequired,
	expanded: PropTypes.bool,
	iconKey: PropTypes.string.isRequired,
	onToggleExpanded: PropTypes.func,
	showToggle: PropTypes.bool,
	title: PropTypes.string.isRequired,
};

export function ImpactPlaylistItem({ playlist }) {
	const created = formatRelativeImpactTime(playlist.add_date);

	return (
		<li className="list-none py-1">
			<div className="flex flex-col gap-2 px-4">
				<a
					href={playlist.url}
					className="body-body-14-bold flex items-start gap-2 text-text-strong no-underline hover:underline focus-visible:ring-2 focus-visible:ring-ring-focus"
				>
					<span className="min-w-0 [overflow-wrap:anywhere]">{playlist.title}</span>
					<Icon name="impactLink" size={18} decorative className="shrink-0 text-text-link" />
				</a>
				<div className="flex flex-col gap-0.5">
					{created ? (
						<p className="body-body-12-regular m-0 text-text-description">Created {created}</p>
					) : null}
					{playlist.curator_name ? (
						<p className="body-body-12-regular m-0 text-text-description">
							By <span className="text-text-link">{playlist.curator_name}</span>
						</p>
					) : null}
				</div>
			</div>
		</li>
	);
}

ImpactPlaylistItem.propTypes = {
	playlist: PropTypes.shape({
		add_date: PropTypes.string,
		curator_name: PropTypes.string,
		title: PropTypes.string.isRequired,
		url: PropTypes.string,
	}).isRequired,
};
