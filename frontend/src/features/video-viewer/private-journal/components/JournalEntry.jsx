import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/components/Button';
import { ConfirmationDialogContent } from '../../../shared/components/ConfirmationDialog';
import { Dialog } from '../../../shared/components/Dialog';
import { Icon } from '../../../shared/components/Icon';
import { Text } from '../../../shared/components';

export function JournalEntry({ note, onUpdate, onDelete, isUpdating = false, isDeleting = false }) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(note.text);
	const menuRef = useRef(null);

	useEffect(() => {
		setDraft(note.text);
	}, [note.text]);

	useEffect(() => {
		if (!menuOpen) return undefined;
		const close = () => {
			setMenuOpen(false);
		};
		const onDocClick = (event) => {
			if (!menuRef.current || menuRef.current.contains(event.target)) return;
			close();
		};
		const onKey = (event) => {
			if (event.key === 'Escape') close();
		};
		document.addEventListener('mousedown', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	}, [menuOpen]);

	const toggleMenu = () => {
		if (menuOpen) {
			setMenuOpen(false);
			return;
		}
		setMenuOpen(true);
	};

	const startEdit = () => {
		setDraft(note.text);
		setIsEditing(true);
		setMenuOpen(false);
	};

	const cancelEdit = () => {
		setDraft(note.text);
		setIsEditing(false);
	};

	const saveEdit = () => {
		const text = draft.trim();
		if (!text || text === note.text) {
			cancelEdit();
			return;
		}
		Promise.resolve(onUpdate?.(note, text))
			.then(() => setIsEditing(false))
			.catch(() => {});
	};

	const handleDeleteClick = () => {
		setMenuOpen(false);
		setDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		Promise.resolve(onDelete?.(note))
			.then(() => {
				setDeleteDialogOpen(false);
			})
			.catch(() => {});
	};

	return (
		<li className="grid grid-cols-[34px_1fr] gap-4">
			<div className="flex flex-col items-center">
				<span className="w-full text-left text-sm leading-5 text-bg-secondary">{note.timestamp}</span>
				<span aria-hidden="true" className="mt-1 h-full w-px bg-border-divider" />
			</div>

			<div className="flex min-w-0 gap-3 items-start">
				<div className="min-w-0 flex-1">
					<Text variant="body-14" className="m-0 text-text-disabled">
						{note.title}
					</Text>

					{isEditing ? (
						<div className="mt-2">
							<label htmlFor={`private-journal-note-edit-${note.id}`} className="sr-only">
								Edit {note.title}
							</label>

							<textarea
								id={`private-journal-note-edit-${note.id}`}
								value={draft}
								onChange={(event) => setDraft(event.target.value)}
								className="mb-0 block min-h-[72px] w-full resize-none rounded-sm border border-border-divider bg-bg-page p-2 text-base leading-6 text-text-primary focus:outline-none focus:ring-2 focus:ring-ring-focus"
							/>

							<div className="mt-2 flex gap-2">
								<Button
									type="button"
									size="sm"
									onClick={saveEdit}
									disabled={isUpdating || draft.trim() === ''}
								>
									{isUpdating ? 'SAVING...' : 'SAVE'}
								</Button>
								<Button
									type="button"
									variant="secondary-outline"
									size="sm"
									onClick={cancelEdit}
									disabled={isUpdating}
								>
									CANCEL
								</Button>
							</div>
						</div>
					) : (
						<Text as="h6" variant="body-16" className="m-0 mt-2">
							{note.text}
						</Text>
					)}

					<Text variant="body-14" className="m-0 text-text-disabled mt-2 flex items-center gap-2">
						<span>{note.dayLabel}</span>
						<span aria-hidden="true">•</span>
						<span>{note.timeLabel}</span>
					</Text>
				</div>

				<div className="relative shrink-0" ref={menuRef}>
					<Button
						variant="icon"
						aria-label={`Open ${note.title} actions`}
						aria-haspopup="menu"
						aria-expanded={menuOpen}
						onClick={toggleMenu}
						icon={<Icon name="threeDots" size={22} />}
					/>

					{menuOpen ? (
						<div
							role="menu"
							className="absolute right-0 top-[26px] z-10 min-w-[140px] rounded-md border border-border-default bg-bg-surface-raised py-1 shadow-lg"
						>
							<button
								type="button"
								role="menuitem"
								onClick={startEdit}
								className="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-sm text-text-strong hover:bg-bg-surface-muted focus-visible:outline-none focus-visible:bg-bg-surface-muted"
							>
								Edit
							</button>
							<button
								type="button"
								role="menuitem"
								onClick={handleDeleteClick}
								className="block w-full cursor-pointer border-0 bg-transparent px-3 py-1.5 text-left text-sm text-text-strong hover:bg-bg-surface-muted focus-visible:outline-none focus-visible:bg-bg-surface-muted"
							>
								Delete
							</button>
						</div>
					) : null}
				</div>
			</div>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<ConfirmationDialogContent
					aria-label={`Delete ${note.title}`}
					title="Delete note?"
					subtitle="This private journal note will be permanently deleted."
					actions={
						<>
							<Button
								type="button"
								variant="secondary-outline"
								size="sm"
								onClick={() => setDeleteDialogOpen(false)}
								disabled={isDeleting}
							>
								CANCEL
							</Button>
							<Button type="button" size="sm" onClick={confirmDelete} disabled={isDeleting}>
								{isDeleting ? 'DELETING...' : 'DELETE'}
							</Button>
						</>
					}
				/>
			</Dialog>
		</li>
	);
}
