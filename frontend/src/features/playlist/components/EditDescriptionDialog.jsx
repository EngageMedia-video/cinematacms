import { useEffect, useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, EditorField } from '../../shared/components';
import { usePlaylistDescriptionMutation } from '../hooks/usePlaylistDescriptionMutation';
import usePlaylistUiStore from '../store/usePlaylistUiStore';

// Edits the playlist description — the single source for the Curator's Notes
// section (#805). Same dialog pattern the create flow's description started in.
export function EditDescriptionDialog({ config, playlist, token }) {
	const open = usePlaylistUiStore((state) => state.descriptionDialogOpen);
	const setOpen = usePlaylistUiStore((state) => state.setDescriptionDialogOpen);
	const [description, setDescription] = useState(playlist?.description || '');
	const mutation = usePlaylistDescriptionMutation(token, config);
	const errorId = 'playlist-description-error';

	useEffect(() => {
		if (open) {
			setDescription(playlist?.description || '');
		}
	}, [open, playlist?.description]);

	function handleSubmit(event) {
		event.preventDefault();
		mutation.mutate(
			{ description },
			{
				onSuccess: () => {
					setOpen(false);
				},
			}
		);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent
				aria-label="Edit playlist description"
				className="w-full max-w-[680px] rounded-2xl border-[0.5px] border-border-subtle bg-linear-to-br from-bg-surface-raised to-bg-surface p-5 shadow-2xl sm:p-[26px]"
				containerClassName="items-end sm:items-center"
			>
				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<h2 className="m-0 text-text-strong heading-h6-20-medium">Curator's Notes</h2>
						<p className="m-0 text-text-muted body-body-14-regular">
							Edit the playlist description shown as this playlist's Curator's Note.
						</p>
					</div>

					<EditorField
						label="Description"
						value={description}
						rows={8}
						enableCounter
						maxWordsLength={450}
						aria-describedby={mutation.isError ? errorId : undefined}
						onChange={(event) => setDescription(event.target.value)}
						className="w-full"
					/>

					{mutation.isError ? (
						<p id={errorId} className="m-0 text-text-danger body-body-14-regular">
							The description could not be saved. Try again.
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
			</DialogContent>
		</Dialog>
	);
}
