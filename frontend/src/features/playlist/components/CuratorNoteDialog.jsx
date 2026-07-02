import { useEffect, useState } from 'react';
import { Button, Dialog, DialogClose, DialogContent, EditorField } from '../../shared/components';
import { useCuratorNoteMutation } from '../hooks/useCuratorNoteMutation';
import usePlaylistUiStore from '../store/usePlaylistUiStore';

export function CuratorNoteDialog({ config, playlist, token }) {
	const open = usePlaylistUiStore((state) => state.curatorNoteDialogOpen);
	const setOpen = usePlaylistUiStore((state) => state.setCuratorNoteDialogOpen);
	const [note, setNote] = useState(playlist?.curator_note || '');
	const mutation = useCuratorNoteMutation(token, config);
	const errorId = 'playlist-curator-note-error';

	useEffect(() => {
		if (open) {
			setNote(playlist?.curator_note || '');
		}
	}, [open, playlist?.curator_note]);

	function handleSubmit(event) {
		event.preventDefault();
		mutation.mutate(
			{ playlist, curatorNote: note },
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
				aria-label="Edit curator note"
				className="w-full max-w-[680px] rounded-2xl border-[0.5px] border-border-subtle bg-linear-to-br from-bg-surface-raised to-bg-surface p-5 shadow-2xl sm:p-[26px]"
				containerClassName="items-end sm:items-center"
			>
				<form onSubmit={handleSubmit} className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<h2 className="m-0 text-text-strong heading-h6-20-medium">Curator's Notes</h2>
						<p className="m-0 text-text-muted body-body-14-regular">
							Add editorial framing for this playlist.
						</p>
					</div>

					<EditorField
						label="Curator note"
						value={note}
						rows={8}
						enableCounter
						maxWordsLength={450}
						aria-describedby={mutation.isError ? errorId : undefined}
						onChange={(event) => setNote(event.target.value)}
						className="w-full"
					/>

					{mutation.isError ? (
						<p id={errorId} className="m-0 text-text-danger body-body-14-regular">
							The curator note could not be saved. Try again.
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
							{mutation.isPending ? 'Saving' : 'Save note'}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
