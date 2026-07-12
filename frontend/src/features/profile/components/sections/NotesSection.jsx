import { Icon, Text } from '../../../shared/components';
import { useAuthorNotes } from '../../hooks/useAuthorNotes';
import { NoteEntry } from './NoteEntry';

function mediaKey(note) {
	const media = note?.media || {};
	return media.friendly_token || media.url || media.title || note.uid;
}

function noteTime(note) {
	const value = new Date(note?.add_date || note?.edit_date || 0).getTime();
	return Number.isNaN(value) ? 0 : value;
}

function latestNotesByFilm(notes) {
	const groups = new Map();

	for (const note of notes) {
		const key = mediaKey(note);
		const current = groups.get(key);
		if (!current) {
			groups.set(key, { note, noteCount: 1 });
			continue;
		}

		current.noteCount += 1;
		if (noteTime(note) > noteTime(current.note)) {
			current.note = note;
		}
	}

	return Array.from(groups.values()).sort((a, b) => noteTime(b.note) - noteTime(a.note));
}

function EmptyNotes() {
	return (
		<div className="flex min-h-[280px] flex-col items-center justify-center gap-4 py-8 text-center">
			<span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-bg-surface-muted text-text-muted">
				<Icon name="notes" size="md" decorative />
			</span>
			<Text as="h3" variant="h6-bold" className="m-0 text-text-primary">
				No notes yet
			</Text>
			<Text as="p" variant="body-14" className="m-0 max-w-md text-text-muted">
				Your private, time-stamped notes on films across Cinemata will appear here. Add notes while watching a
				film to keep track of key moments.
			</Text>
		</div>
	);
}

export function NotesSection({ author }) {
	// Notes are private and owner-only; never fetch another user's notes.
	const isOwner = Boolean(author?.is_owner);
	const { data, isLoading, isError } = useAuthorNotes(author?.username, isOwner);

	if (!isOwner) return <EmptyNotes />;

	if (isLoading) {
		return <div className="h-64 animate-pulse rounded-xl bg-bg-skeleton" aria-label="Loading notes" />;
	}
	if (isError) return <Text className="text-text-danger">Your notes could not be loaded.</Text>;

	const notes = Array.isArray(data?.results) ? data.results : [];
	if (!notes.length) return <EmptyNotes />;
	const filmNotes = latestNotesByFilm(notes);

	return (
		<ul className="-mx-4 grid list-none grid-cols-1 justify-items-center gap-y-[48px] p-0 sm:mx-0 xl:grid-cols-[repeat(2,564px)] xl:justify-items-start xl:gap-x-[33px] xl:gap-y-[37px]">
			{filmNotes.map(({ note, noteCount }) => (
				<NoteEntry key={mediaKey(note)} note={note} noteCount={noteCount} />
			))}
		</ul>
	);
}
