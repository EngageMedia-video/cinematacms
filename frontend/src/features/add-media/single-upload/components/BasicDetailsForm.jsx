import { EditorField } from '../../../shared/components/EditorField';
import { TextField } from '../../../shared/components/TextField';
import { YearChooserField } from '../../../shared/components/YearChooserField';
import { maxWords, required } from '../../../shared/utils/validators';
import { FieldGroup } from './FieldGroup';

export function BasicDetailsForm({ singleUpload }) {
	const { errors } = singleUpload;

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
				required
				placeholder="Write here..."
				value={singleUpload.title}
				onChange={(event) => singleUpload.setTitle(event.target.value)}
				helperText={errors.title}
				invalid={!!errors.title}
				validate={[required()]}
			/>

			<EditorField
				className="w-full"
				id="summary"
				name="summary"
				label="Synopsis"
				required
				placeholder="Write here..."
				enableCounter
				maxWordsLength={80}
				value={singleUpload.summary}
				onChange={(event) => singleUpload.setSummary(event.target.value)}
				helperText={errors.summary || 'Maximum 80 Words'}
				invalid={!!errors.summary}
				validate={[required(), maxWords(80)]}
			/>

			<EditorField
				className="w-full"
				id="description"
				name="description"
				label="More Information and Credits"
				placeholder="Write here..."
				value={singleUpload.description}
				onChange={(event) => singleUpload.setDescription(event.target.value)}
				helperText={errors.description}
				invalid={!!errors.description}
			/>

			<YearChooserField
				className="w-full"
				name="year_produced"
				label="Year Produced"
				required
				value={singleUpload.yearProduced}
				onChange={singleUpload.setYearProduced}
				error={errors.year_produced}
				minYear={2000}
			/>
		</FieldGroup>
	);
}
