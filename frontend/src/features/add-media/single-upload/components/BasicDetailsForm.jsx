import { EditorField } from '../../../shared/components/EditorField';
import { TextField } from '../../../shared/components/TextField';
import { maxWords, required } from '../../../shared/utils/validators';
import { FieldGroup } from './FieldGroup';

export function BasicDetailsForm({ errors }) {
	return (
		<FieldGroup
			title="Basic Details"
			description="Add the information viewers and editors need before this media is published."
		>
			<TextField
				className="w-full"
				id="title"
				name="title"
				label="Title"
				placeholder="Write here..."
				helperText={errors.title}
				invalid={!!errors.title}
			/>

			<EditorField
				className="w-full"
				id="summary"
				name="summary"
				label="Synopsis"
				required
				placeholder="Write here..."
				helperText={errors.summary || 'Maximum 60 Words'}
				invalid={!!errors.summary}
				validate={[required(), maxWords(60)]}
			/>

			<EditorField
				className="w-full"
				id="description"
				name="description"
				label="More Information and Credits"
				placeholder="Write here..."
				helperText={errors.description}
				invalid={!!errors.description}
			/>

			<TextField
				className="w-full"
				id="year_produced"
				name="year_produced"
				label="Year Produced"
				placeholder="Write here..."
				helperText={errors.year_produced}
				invalid={!!errors.year_produced}
				required
				validate={[required()]}
			/>
		</FieldGroup>
	);
}
