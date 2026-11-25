import PropTypes from 'prop-types';
import { Badge, Button, Icon } from '../../../shared/components';
import { getVariantClasses } from '../../../shared/components/Button/Button';
import { cn } from '../../../shared/utils/classNames';
import { IMPACT_FORM_FIELDS } from './impactFormFields';
import { getSafeHref } from './utils/formatDate';
import { impactYear } from './utils/groupImpactEntries';

const STATUS_BADGES = {
	approved: { label: 'APPROVED', color: 'bg/status-approved' },
	waiting_approval: { label: 'WAITING FOR REVIEW', color: 'bg/status-waiting' },
};

const ACTION_BUTTON_CLASSES = 'h-10 py-0 focus-visible:ring-2 focus-visible:ring-ring-focus';

function join(parts, separator) {
	return parts.filter(Boolean).join(separator);
}

// The lines under an entry's title, following the Figma "CI Entry" variant for its category.
function entryDetails(entry) {
	switch (entry.category) {
		case 'award':
			return entry.organiser
				? [{ text: entry.organiser, className: 'body-body-16-regular text-text-strong' }]
				: [];
		case 'screening':
			return entry.organiser
				? [{ text: `Organized by ${entry.organiser}`, className: 'body-body-12-regular text-text-strong' }]
				: [];
		case 'teaching':
		case 'academic': {
			const place = join([entry.organiser, entry.country_label], ', ');
			return place ? [{ text: place, className: 'body-body-12-regular text-text-secondary' }] : [];
		}
		case 'article':
		case 'featured':
			return [entry.creator ? `By ${entry.creator}` : '', entry.publication]
				.filter(Boolean)
				.map((text) => ({ text, className: 'body-body-12-regular text-text-strong' }));
		default:
			return entry.details ? [{ text: entry.details, className: 'body-body-12-regular text-text-strong' }] : [];
	}
}

function EntryActions({ entry, onDelete, onEdit }) {
	const reviewUrl = entry.viewer_review_url || '';
	// An entry waiting for a moderator's review offers REVIEW alone; the review page edits,
	// approves, or rejects it. Only categories the form can edit offer EDIT.
	const canEdit = Boolean(!reviewUrl && entry.viewer_can_edit && onEdit && IMPACT_FORM_FIELDS[entry.category]);
	const canDelete = Boolean(!reviewUrl && entry.viewer_can_delete && onDelete);

	if (!canEdit && !canDelete && !reviewUrl) {
		return null;
	}

	return (
		<div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
			{reviewUrl ? (
				<a
					href={reviewUrl}
					aria-label={`Review ${entry.title}`}
					className={cn(
						'body-body-14-bold inline-flex items-center gap-2 rounded-ds-4 px-4 no-underline',
						getVariantClasses('secondary'),
						ACTION_BUTTON_CLASSES
					)}
				>
					<Icon name="eye" size={24} decorative />
					REVIEW
				</a>
			) : null}
			{canEdit ? (
				<Button
					variant="secondary"
					className={cn('px-4', ACTION_BUTTON_CLASSES)}
					icon={<Icon name="impactPencil" size={20} decorative />}
					aria-label={`Edit ${entry.title}`}
					onClick={() => onEdit(entry)}
				>
					EDIT
				</Button>
			) : null}
			{canDelete ? (
				<Button
					variant="text"
					className={cn('px-3 text-text-danger hover:text-text-danger', ACTION_BUTTON_CLASSES)}
					aria-label={`Delete ${entry.title}`}
					onClick={() => onDelete(entry)}
				>
					DELETE
				</Button>
			) : null}
		</div>
	);
}

EntryActions.propTypes = {
	entry: PropTypes.object.isRequired,
	onDelete: PropTypes.func,
	onEdit: PropTypes.func,
};

export function ImpactEntry({ entry, onDelete, onEdit }) {
	const badge = entry.viewer_sees_status ? STATUS_BADGES[entry.status] : null;
	const year = impactYear(entry);
	const author = entry.author_name || entry.author_username;
	const href = getSafeHref(entry.url);

	return (
		<li className="list-none">
			<article
				aria-label={entry.title}
				className="box-border flex w-full flex-col gap-4 rounded-ds-8 bg-bg-surface px-4 pt-2 pb-1 sm:flex-row sm:items-start sm:gap-8"
			>
				<div className="flex min-w-0 flex-1 flex-col items-start gap-1">
					{badge ? (
						<Badge color={badge.color} className="caption-caption-10-semibold">
							{badge.label}
						</Badge>
					) : null}
					<p className="body-body-14-bold m-0 text-text-strong [overflow-wrap:anywhere]">
						{href ? (
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-inherit no-underline hover:underline focus-visible:ring-2 focus-visible:ring-ring-focus"
							>
								{entry.title}
							</a>
						) : (
							entry.title
						)}
					</p>
					{entryDetails(entry).map((line) => (
						<p key={line.text} className={cn('m-0 [overflow-wrap:anywhere]', line.className)}>
							{line.text}
						</p>
					))}
					{year ? <p className="body-body-14-regular m-0 text-text-description">{year}</p> : null}
					{author ? (
						<p className="body-body-12-regular m-0 text-text-description">
							Added by <span className="text-text-link">{author}</span>
						</p>
					) : null}
				</div>
				<EntryActions entry={entry} onDelete={onDelete} onEdit={onEdit} />
			</article>
		</li>
	);
}

ImpactEntry.propTypes = {
	entry: PropTypes.shape({
		author_name: PropTypes.string,
		author_username: PropTypes.string,
		category: PropTypes.string,
		country_label: PropTypes.string,
		creator: PropTypes.string,
		details: PropTypes.string,
		event_date: PropTypes.string,
		organiser: PropTypes.string,
		publication: PropTypes.string,
		status: PropTypes.string,
		title: PropTypes.string.isRequired,
		uid: PropTypes.string,
		url: PropTypes.string,
		viewer_can_delete: PropTypes.bool,
		viewer_can_edit: PropTypes.bool,
		viewer_review_url: PropTypes.string,
		viewer_sees_status: PropTypes.bool,
		year: PropTypes.number,
	}).isRequired,
	onDelete: PropTypes.func,
	onEdit: PropTypes.func,
};
