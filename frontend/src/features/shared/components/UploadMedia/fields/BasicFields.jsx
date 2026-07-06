import { EditorField } from '../../EditorField';
import { TextField } from '../../TextField';
import { YearChooserField } from '../../YearChooserField';
import { SYNOPSIS_MAX_WORDS } from '../schema/mediaMetadataSchema';

// Controlled basic-detail fields shared by single upload and bulk per-file
// metadata forms.

export function TitleField({ value = '', onChange, error = '', validate, id, name }) {
	return (
		<TextField
			className="w-full"
			id={id}
			name={name}
			label="Title"
			required
			placeholder="Write here..."
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			validate={validate}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function SynopsisField({ value = '', onChange, error = '', validate, id, name }) {
	return (
		<EditorField
			className="w-full"
			id={id}
			name={name}
			label="Synopsis"
			required
			placeholder="Write here..."
			rows={5}
			enableCounter
			maxWordsLength={SYNOPSIS_MAX_WORDS}
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			validate={validate}
			invalid={Boolean(error)}
			helperText={error || `Maximum ${SYNOPSIS_MAX_WORDS} Words`}
		/>
	);
}

export function MoreInfoField({ value = '', onChange, error = '', id, name }) {
	return (
		<EditorField
			className="w-full"
			id={id}
			name={name}
			label="More Information and Credits"
			placeholder="Write here..."
			rows={5}
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function YearProducedField({ value = '', onChange, error = '', id, name }) {
	return (
		<YearChooserField
			className="w-full"
			id={id}
			name={name}
			label="Year Produced"
			required
			value={value}
			onChange={(year) => onChange?.(year)}
			error={error}
		/>
	);
}
