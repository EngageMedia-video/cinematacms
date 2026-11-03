import { useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, EditorField, TextField } from '../../shared/components';
import { required } from '../../shared/utils/validators';
import { usePlaylistUpdateMutation } from '../hooks/usePlaylistUpdateMutation';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import { PLAYLIST_TITLE_MAX_LENGTH } from '../utils/playlist';

const TITLE_REQUIRED = 'Title is required.';
const validateTitle = required(TITLE_REQUIRED);

function changedFields(playlist, title, description) {
	const changes = {};

	if (title !== playlist?.title) {
		changes.title = title;
	}

	if (description !== (playlist?.description || '')) {
		changes.description = description;
	}

	return changes;
}

// Edits the playlist title and description. The description is the single
// source for the Curator's Note section (#805).
export function EditPlaylistDialog({ config, playlist, token }) {
	const open = usePlaylistUiStore((state) => state.editDialogOpen);
	const setOpen = usePlaylistUiStore((state) => state.setEditDialogOpen);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				aria-label="Edit playlist"
				className="w-full max-w-[680px] rounded-2xl border-[0.5px] border-border-subtle bg-linear-to-br from-bg-surface-raised to-bg-surface p-5 shadow-2xl sm:p-[26px]"
				containerClassName="items-end sm:items-center"
			>
				<EditPlaylistForm config={config} playlist={playlist} token={token} onDone={() => setOpen(false)} />
			</DialogContent>
		</Dialog>
	);
}

// DialogContent unmounts its children while closed, so each open starts from
// the current playlist with a fresh mutation and no stale error banner.
function EditPlaylistForm({ config, playlist, token, onDone }) {
	const [title, setTitle] = useState(playlist?.title || '');
	const [description, setDescription] = useState(playlist?.description || '');
	const [titleError, setTitleError] = useState('');
	const mutation = usePlaylistUpdateMutation(token, config);
	const errorId = 'playlist-edit-error';

	function handleSubmit(event) {
		event.preventDefault();

		const trimmedTitle = title.trim();
		const error = validateTitle(trimmedTitle);
		if (error) {
			setTitleError(error);
			return;
		}

		const changes = changedFields(playlist, trimmedTitle, description);
		if (Object.keys(changes).length === 0) {
			onDone();
			return;
		}

		mutation.mutate(changes, { onSuccess: onDone });
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-5">
			<div className="flex flex-col gap-2">
				<h2 className="m-0 text-text-strong heading-h6-20-medium">Edit Playlist</h2>
				<p className="m-0 text-text-muted body-body-14-regular">
					Update your playlist title and Curator's Note.
				</p>
			</div>

			<TextField
				label="Title"
				value={title}
				maxLength={PLAYLIST_TITLE_MAX_LENGTH}
				showCharacterCount
				validate={validateTitle}
				invalid={Boolean(titleError)}
				helperText={titleError}
				onChange={(event) => {
					setTitle(event.target.value);
					setTitleError('');
				}}
				className="w-full"
			/>

			{/* No word limit: Playlist.description and the Create New Playlist
					    form are unbounded, and EditorField's limiter truncates an
					    over-limit value on render — silently dropping existing text. */}
			<EditorField
				label="Curator's Note"
				value={description}
				rows={8}
				helperText="Explain why these films belong together. Links you paste here become clickable automatically."
				aria-describedby={mutation.isError ? errorId : undefined}
				onChange={(event) => setDescription(event.target.value)}
				className="w-full"
			/>

			{mutation.isError ? (
				<p id={errorId} className="m-0 text-text-danger body-body-14-regular">
					Your changes could not be saved. Try again.
				</p>
			) : null}

			<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<DialogClose>
					<Button
						variant="tertiary"
						disabled={mutation.isPending}
						className="focus-visible:ring-2 focus-visible:ring-ring-focus"
					>
						Cancel
					</Button>
				</DialogClose>
				<Button
					type="submit"
					disabled={mutation.isPending}
					className="focus-visible:ring-2 focus-visible:ring-ring-focus"
				>
					{mutation.isPending ? 'Saving' : 'Save'}
				</Button>
			</div>
		</form>
	);
}
