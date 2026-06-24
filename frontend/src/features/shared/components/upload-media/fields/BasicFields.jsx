import { EditorField } from '../../EditorField';
import { TextField } from '../../TextField';
import { YearChooserField } from '../../YearChooserField';
import { SYNOPSIS_MAX_WORDS } from '../schema/mediaMetadataSchema';

// Controlled twins of the single-upload BasicDetailsForm fields (kept visually
// identical: same labels, placeholders, widgets and helper text), driven by
// per-file metadata so the bulk wizard can render one set per file.

export function TitleField({ value = '', onChange, error = '' }) {
	return (
		<TextField
			className="w-full"
			label="Title"
			placeholder="Write here..."
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function SynopsisField({ value = '', onChange, error = '' }) {
	return (
		<EditorField
			className="w-full"
			label="Synopsis"
			required
			placeholder="Write here..."
			rows={5}
			enableCounter
			maxWordsLength={SYNOPSIS_MAX_WORDS}
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error || `Maximum ${SYNOPSIS_MAX_WORDS} Words`}
		/>
	);
}

export function MoreInfoField({ value = '', onChange }) {
	return (
		<EditorField
			className="w-full"
			label="More Information and Credits"
			placeholder="Write here..."
			rows={5}
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	);
}

export function YearProducedField({ value = '', onChange, error = '' }) {
	return (
		<YearChooserField
			className="w-full"
			label="Year Produced"
			required
			value={value}
			onChange={(year) => onChange?.(year)}
			error={error}
		/>
	);
}
