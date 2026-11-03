import { useState } from 'react';
import {
	Button,
	ConfirmationDialogContent,
	Dialog,
	DialogClose,
	EditorField,
	TextField,
} from '../../shared/components';
import { required } from '../../shared/utils/validators';
import { usePlaylistUpdateMutation } from '../hooks/usePlaylistUpdateMutation';
import usePlaylistUiStore from '../store/usePlaylistUiStore';
import { PLAYLIST_TITLE_MAX_LENGTH } from '../utils/playlist';

const TITLE_REQUIRED = 'Title is required.';
const validateTitle = required(TITLE_REQUIRED);
const FORM_ID = 'playlist-edit-form';
const HINT_ID = 'playlist-curator-note-hint';
const ERROR_ID = 'playlist-edit-error';

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

	// Mounted only while open, so each open starts from the current playlist
	// with a fresh mutation and no stale error message.
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{open ? (
				<EditPlaylistContent config={config} playlist={playlist} token={token} onDone={() => setOpen(false)} />
			) : null}
		</Dialog>
	);
}

function EditPlaylistContent({ config, playlist, token, onDone }) {
	const [title, setTitle] = useState(playlist?.title || '');
	const [description, setDescription] = useState(playlist?.description || '');
	const [titleError, setTitleError] = useState('');
	const mutation = usePlaylistUpdateMutation(token, config);
	const curatorNoteDescribedBy = mutation.isError ? `${HINT_ID} ${ERROR_ID}` : HINT_ID;

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
		<ConfirmationDialogContent
			aria-label="Edit playlist"
			title="Edit Playlist"
			subtitle="Update your playlist title and Curator's Note."
			actions={
				<>
					<DialogClose>
						<Button variant="secondary-outline" disabled={mutation.isPending}>
							Cancel
						</Button>
					</DialogClose>
					{/* ConfirmationDialogContent renders actions outside its children,
					    so Save joins the form through the form attribute. */}
					<Button type="submit" form={FORM_ID} variant="primary" disabled={mutation.isPending}>
						{mutation.isPending ? 'Saving' : 'Save'}
					</Button>
				</>
			}
		>
			<form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-5">
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
				    over-limit value on render — silently dropping existing text.
				    The hint sits outside EditorField's helperText, which renders in
				    the accent colour and reads as a warning. */}
				<div className="flex flex-col gap-2">
					<EditorField
						label="Curator's Note"
						value={description}
						rows={8}
						aria-describedby={curatorNoteDescribedBy}
						onChange={(event) => setDescription(event.target.value)}
						className="w-full"
					/>
					<p id={HINT_ID} className="m-0 text-text-muted body-body-12-regular">
						Explain why these films belong together. Links you paste here become clickable automatically.
					</p>
				</div>

				{mutation.isError ? (
					<p id={ERROR_ID} className="m-0 text-text-danger body-body-14-regular">
						Your changes could not be saved. Try again.
					</p>
				) : null}
			</form>
		</ConfirmationDialogContent>
	);
}
