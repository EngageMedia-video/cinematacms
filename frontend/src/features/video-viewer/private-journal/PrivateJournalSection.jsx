import { QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import privateJournalQueryClient from './queryClient';
import { formatClock, formatDayLabel, formatTimestamp, getCurrentPlayerTime } from './utils/journalMedia';
import { Text } from '../../shared/components';
import { JournalEntry } from './components/JournalEntry';
import { PrivateJournalEmptyState } from './components/PrivateJournalEmptyState';
import { PrivateJournalInput } from './components/PrivateJournalInput';
import { useDeletePrivateJournalNote } from './hooks/useDeletePrivateJournalNote';
import { usePrivateJournalNotes } from './hooks/usePrivateJournalNotes';
import { useSubmitPrivateJournalNote } from './hooks/useSubmitPrivateJournalNote';
import { useUpdatePrivateJournalNote } from './hooks/useUpdatePrivateJournalNote';

function getCreatedAt(note) {
	if (note.createdAt) return note.createdAt;
	const parsed = Date.parse(note.add_date);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeNotes(notes) {
	const noteNumbers = new Map(
		[...notes]
			.sort((a, b) => getCreatedAt(a) - getCreatedAt(b))
			.map((note, index) => [note.uid || note.id, index + 1])
	);

	return [...notes]
		.sort((a, b) => getCreatedAt(b) - getCreatedAt(a))
		.map((note) => {
			const createdAt = getCreatedAt(note);
			const noteId = note.uid || note.id;
			return {
				...note,
				id: noteId,
				title: note.title || `Note #${noteNumbers.get(noteId) || 1}`,
				timestamp: note.timestamp || formatTimestamp(note.timestamp_seconds ?? 0),
				dayLabel: note.dayLabel || formatDayLabel(createdAt),
				timeLabel: note.timeLabel || formatClock(createdAt),
				createdAt,
			};
		});
}

function PrivateJournalSectionInner({ friendlyToken, initialNotes = [] }) {
	const [notes, setNotes] = useState(initialNotes);
	const [draft, setDraft] = useState('');
	const notesQuery = usePrivateJournalNotes(friendlyToken, { enabled: !!friendlyToken });
	const submitMutation = useSubmitPrivateJournalNote(friendlyToken);
	const updateMutation = useUpdatePrivateJournalNote(friendlyToken);
	const deleteMutation = useDeletePrivateJournalNote(friendlyToken);
	const sourceNotes = friendlyToken ? notesQuery.data?.results || [] : notes;
	const sortedNotes = useMemo(() => normalizeNotes(sourceNotes), [sourceNotes]);

	const submitNote = () => {
		const text = draft.trim();
		if (!text) return;

		const now = new Date();
		const playerTime = getCurrentPlayerTime();
		const timestampSeconds = playerTime ?? 0;

		if (friendlyToken) {
			submitMutation.mutate(
				{ text, timestampSeconds },
				{
					onSuccess: () => setDraft(''),
				}
			);
			return;
		}

		const nextNumber = notes.length + 1;

		setNotes((currentNotes) => [
			...currentNotes,
			{
				id: `${now.getTime()}-${nextNumber}`,
				title: `Note #${nextNumber}`,
				text,
				timestamp: formatTimestamp(timestampSeconds),
				dayLabel: 'Today',
				timeLabel: formatClock(now),
				createdAt: now.getTime(),
			},
		]);
		setDraft('');
	};

	const updateNote = (note, text) => {
		if (friendlyToken) {
			return updateMutation.mutateAsync({ uid: note.uid || note.id, text });
		}
		setNotes((currentNotes) =>
			currentNotes.map((currentNote) =>
				currentNote.id === note.id ? { ...currentNote, text, edit_date: new Date().toISOString() } : currentNote
			)
		);
		return Promise.resolve();
	};

	const deleteNote = (note) => {
		if (friendlyToken) {
			return deleteMutation.mutateAsync(note.uid || note.id);
		}
		setNotes((currentNotes) => currentNotes.filter((currentNote) => currentNote.id !== note.id));
		return Promise.resolve();
	};

	return (
		<section className="flex flex-col bg-bg-surface px-4 pt-[22px] pb-4">
			<div className="flex flex-col gap-2">
				<Text as="h2" variant="h6-medium" className="m-0">
					Your Film Notes
				</Text>

				<Text as="p" variant="body-14" className="m-0 text-text-disabled">
					Feel free to write or document your thoughts on this film, something to reference later, or general
					observations, etc.
				</Text>
			</div>

			<Text as="p" variant="body-14" className="m-0 mt-6 text-text-disabled">
				Your notes are private, and can't be seen by anyone else.
			</Text>

			<div className="mt-6 border-t border-border-divider" />

			<div className={sortedNotes.length ? 'py-6' : 'pt-6 pb-6'}>
				{notesQuery.isLoading ? (
					<p className="py-4 text-center text-sm text-text-muted">Loading notes...</p>
				) : notesQuery.isError ? (
					<p className="py-4 text-center text-sm text-text-muted">Could not load notes.</p>
				) : sortedNotes.length ? (
					<ul className="m-0 flex list-none flex-col gap-6 p-0">
						{sortedNotes.map((note) => (
							<JournalEntry
								key={note.id}
								note={note}
								onUpdate={updateNote}
								onDelete={deleteNote}
								isUpdating={updateMutation.isPending}
								isDeleting={deleteMutation.isPending}
							/>
						))}
					</ul>
				) : (
					<PrivateJournalEmptyState />
				)}
			</div>

			<PrivateJournalInput
				value={draft}
				onChange={setDraft}
				onSubmit={submitNote}
				disabled={notesQuery.isError}
				isSubmitting={submitMutation.isPending}
			/>
		</section>
	);
}

export function PrivateJournalSection({ friendlyToken, initialNotes = [] }) {
	return (
		<QueryClientProvider client={privateJournalQueryClient}>
			<PrivateJournalSectionInner friendlyToken={friendlyToken} initialNotes={initialNotes} />
		</QueryClientProvider>
	);
}
