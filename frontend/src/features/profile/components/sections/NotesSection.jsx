import { Icon, Text } from '../../../shared/components';
import { useAuthorNotes } from '../../hooks/useAuthorNotes';
import { NoteEntry } from './NoteEntry';

function noteKey(note) {
	const media = note?.media || {};
	return media.friendly_token || media.url || media.title || note.uid;
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

	// The endpoint already returns one latest note per film with a note_count,
	// newest film first — render directly, no client-side grouping.
	const films = Array.isArray(data?.results) ? data.results : [];
	if (!films.length) return <EmptyNotes />;

	return (
		<ul className="-mx-4 grid list-none grid-cols-1 justify-items-center gap-y-[48px] p-0 sm:mx-0 xl:grid-cols-[repeat(2,564px)] xl:justify-items-start xl:gap-x-[33px] xl:gap-y-[37px]">
			{films.map((note) => (
				<NoteEntry key={noteKey(note)} note={note} noteCount={note.note_count || 1} />
			))}
		</ul>
	);
}
