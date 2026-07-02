import { useMemo, useState } from 'react';
import { formatTimestamp } from './utils/journalMedia';
import { getCurrentPlayerTime } from './utils/journalMedia';
import { Text } from '../../shared/components';
import { JournalEntry } from './components/JournalEntry';
import { PrivateJournalEmptyState } from './components/PrivateJournalEmptyState';
import { PrivateJournalInput } from './components/PrivateJournalInput';

function formatClock(date) {
	return date
		.toLocaleTimeString([], {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true,
		})
		.replace(' ', '');
}

export function PrivateJournalSection({ initialNotes = [] }) {
	const [notes, setNotes] = useState(initialNotes);
	const [draft, setDraft] = useState('');
	const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.createdAt - a.createdAt), [notes]);

	const submitNote = () => {
		const text = draft.trim();
		if (!text) return;

		const now = new Date();
		const playerTime = getCurrentPlayerTime();
		const nextNumber = notes.length + 1;

		setNotes((currentNotes) => [
			...currentNotes,
			{
				id: `${now.getTime()}-${nextNumber}`,
				title: `Note #${nextNumber}`,
				text,
				timestamp: formatTimestamp(playerTime ?? 0),
				dayLabel: 'Today',
				timeLabel: formatClock(now),
				createdAt: now.getTime(),
			},
		]);
		setDraft('');
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
				{sortedNotes.length ? (
					<ul className="m-0 flex list-none flex-col gap-6 p-0">
						{sortedNotes.map((note) => (
							<JournalEntry key={note.id} note={note} />
						))}
					</ul>
				) : (
					<PrivateJournalEmptyState />
				)}
			</div>

			<PrivateJournalInput value={draft} onChange={setDraft} onSubmit={submitNote} />
		</section>
	);
}
