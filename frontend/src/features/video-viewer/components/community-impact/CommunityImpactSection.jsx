import PropTypes from 'prop-types';
import { useEffect, useId, useMemo, useState } from 'react';
import { Button, ConfirmationDialogContent, Dialog, DialogClose, Text } from '../../../shared/components';
import { AddImpactDialog } from './AddImpactDialog';
import { ImpactEmptyState } from './ImpactEmptyState';
import { ImpactEntry } from './ImpactEntry';
import { IMPACT_GROUP_PREVIEW_COUNT, ImpactGroup, ImpactPlaylistItem } from './ImpactGroup';
import { getImpactPlaylists, groupImpactEntries } from './utils/groupImpactEntries';

const ADD_BUTTON_CLASSES =
	'h-10 w-full shrink-0 justify-center bg-bg-secondary px-4 py-0 text-text-on-primary hover:bg-bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring-focus @lg:w-fit';

function previewOf(items, expanded) {
	return expanded ? items : items.slice(0, IMPACT_GROUP_PREVIEW_COUNT);
}

export function CommunityImpactSection({
	canAdd = true,
	description = 'For filmmakers & viewers. A list of where the film has been screened, written about, taught, or recognised',
	entries = {},
	onAddImpact,
	onDeleteImpact,
	onEditImpact,
	onSubmitErrorClear,
	submitError = null,
	submitMessage = '',
	submitStatus = 'idle',
	title = "Film's Impact",
}) {
	const [dialogOpen, setDialogOpen] = useState(false);
	// The entry being edited; null while the dialog adds a new impact.
	const [editingEntry, setEditingEntry] = useState(null);
	const [deletingEntry, setDeletingEntry] = useState(null);
	const [expandedGroups, setExpandedGroups] = useState(() => new Set());
	const headingId = useId();
	const groups = useMemo(() => groupImpactEntries(entries), [entries]);
	const { playlists, count: playlistCount } = useMemo(() => getImpactPlaylists(entries), [entries]);
	const hasImpact = groups.length > 0 || playlists.length > 0;

	useEffect(() => {
		if (submitStatus === 'success') {
			setDialogOpen(false);
		}
	}, [submitStatus]);

	function openAddDialog() {
		setEditingEntry(null);
		setDialogOpen(true);
	}

	function openEditDialog(entry) {
		setEditingEntry(entry);
		setDialogOpen(true);
	}

	function handleSubmit(values) {
		if (editingEntry) {
			onEditImpact?.(editingEntry, values);
		} else {
			onAddImpact?.(values);
		}
	}

	function confirmDelete() {
		if (deletingEntry) {
			onDeleteImpact?.(deletingEntry);
		}
		setDeletingEntry(null);
	}

	function toggleGroup(key) {
		setExpandedGroups((current) => {
			const next = new Set(current);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}

	function renderPlaylists() {
		const expanded = expandedGroups.has('saves');

		return (
			<ImpactGroup
				title="Playlists"
				iconKey="saves"
				count={playlistCount}
				expanded={expanded}
				showToggle={playlists.length > IMPACT_GROUP_PREVIEW_COUNT}
				onToggleExpanded={() => toggleGroup('saves')}
			>
				{previewOf(playlists, expanded).map((playlist) => (
					<ImpactPlaylistItem key={playlist.friendly_token ?? playlist.url} playlist={playlist} />
				))}
			</ImpactGroup>
		);
	}

	return (
		<section aria-labelledby={headingId} className="@container flex w-full flex-col gap-4 text-text-primary">
			<h2 id={headingId} className="sr-only">
				{title}
			</h2>

			<div className="flex flex-col gap-4 @lg:flex-row @lg:items-center @lg:justify-between">
				<p className="body-body-14-regular m-0 max-w-[697px] text-text-description">{description}</p>

				{/* The empty state carries its own ADD IMPACT button, so the header shows one only once impacts are listed. */}
				{canAdd && hasImpact ? (
					<Button className={ADD_BUTTON_CLASSES} onClick={openAddDialog}>
						ADD IMPACT
					</Button>
				) : null}
			</div>

			{submitMessage ? (
				<Text as="p" variant="body-14-bold" color="accent" className="m-0" aria-live="polite">
					{submitMessage}
				</Text>
			) : null}

			<hr className="m-0 border-0 border-t border-border-divider" />

			{hasImpact ? (
				<div className="grid grid-cols-1 items-start gap-4 @4xl:grid-cols-3">
					{groups.length ? (
						<div
							className={
								playlists.length
									? 'flex flex-col gap-5 @4xl:col-span-2'
									: 'flex flex-col gap-5 @4xl:col-span-3'
							}
						>
							{groups.map((group) => {
								const expanded = expandedGroups.has(group.key);

								return (
									<ImpactGroup
										key={group.key}
										title={group.title}
										iconKey={group.key}
										count={group.entries.length}
										expanded={expanded}
										showToggle={group.entries.length > IMPACT_GROUP_PREVIEW_COUNT}
										onToggleExpanded={() => toggleGroup(group.key)}
									>
										{previewOf(group.entries, expanded).map((entry) => (
											<ImpactEntry
												key={entry.uid ?? `${entry.category}-${entry.title}`}
												entry={entry}
												onEdit={onEditImpact ? openEditDialog : undefined}
												onDelete={onDeleteImpact ? setDeletingEntry : undefined}
											/>
										))}
									</ImpactGroup>
								);
							})}
						</div>
					) : null}
					{playlists.length ? (
						<div className={groups.length ? undefined : '@4xl:col-span-3'}>{renderPlaylists()}</div>
					) : null}
				</div>
			) : (
				<ImpactEmptyState canAdd={canAdd} onAddImpact={openAddDialog} />
			)}

			<AddImpactDialog
				open={dialogOpen}
				impact={editingEntry}
				onClose={() => {
					setDialogOpen(false);
					if (submitError) {
						onSubmitErrorClear?.();
					}
				}}
				onSubmit={handleSubmit}
				onSubmitErrorClear={onSubmitErrorClear}
				submitError={submitError}
				submitting={submitStatus === 'submitting'}
			/>

			<Dialog
				open={Boolean(deletingEntry)}
				onOpenChange={(nextOpen) => {
					if (!nextOpen) {
						setDeletingEntry(null);
					}
				}}
			>
				{deletingEntry ? (
					<ConfirmationDialogContent
						title="Delete this impact?"
						subtitle={`“${deletingEntry.title}” will be removed from this film's Community Impact. This cannot be undone.`}
						actions={
							<>
								<DialogClose asChild>
									<Button variant="secondary" className="h-10 px-4 py-0">
										CANCEL
									</Button>
								</DialogClose>
								<Button
									className="h-10 bg-bg-danger px-4 py-0 text-text-on-primary hover:bg-bg-danger-strong-hover"
									onClick={confirmDelete}
								>
									DELETE
								</Button>
							</>
						}
					/>
				) : null}
			</Dialog>
		</section>
	);
}

const entryShape = PropTypes.shape({
	category: PropTypes.string,
	title: PropTypes.string.isRequired,
	uid: PropTypes.string,
});

const entryCategoryShape = PropTypes.oneOfType([
	PropTypes.arrayOf(entryShape),
	PropTypes.shape({
		entries: PropTypes.arrayOf(entryShape),
		totalCount: PropTypes.number,
	}),
]);

CommunityImpactSection.propTypes = {
	canAdd: PropTypes.bool,
	description: PropTypes.string,
	title: PropTypes.string,
	entries: PropTypes.shape({
		academic: PropTypes.oneOfType([PropTypes.arrayOf(entryShape), PropTypes.object]),
		article: entryCategoryShape,
		award: entryCategoryShape,
		featured: entryCategoryShape,
		curated: entryCategoryShape,
		referenced: entryCategoryShape,
		saves: PropTypes.shape({
			lastEventAt: PropTypes.string,
			playlists: PropTypes.arrayOf(
				PropTypes.shape({
					add_date: PropTypes.string,
					curator_name: PropTypes.string,
					friendly_token: PropTypes.string,
					title: PropTypes.string.isRequired,
					url: PropTypes.string,
				})
			),
			totalCount: PropTypes.shape({
				playlists: PropTypes.number,
				saves: PropTypes.number,
			}),
		}),
		screening: entryCategoryShape,
		teaching: entryCategoryShape,
	}),
	onAddImpact: PropTypes.func,
	onDeleteImpact: PropTypes.func,
	onEditImpact: PropTypes.func,
	onSubmitErrorClear: PropTypes.func,
	submitError: PropTypes.shape({
		field: PropTypes.string,
		message: PropTypes.string.isRequired,
	}),
	submitMessage: PropTypes.string,
	submitStatus: PropTypes.oneOf(['idle', 'submitting', 'success', 'error']),
};
