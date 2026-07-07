import { MoreInfoField, SynopsisField, TitleField, YearProducedField } from '../../../shared/components/UploadMedia';
import { maxWords, required } from '../../../shared/utils/validators';
import { FieldGroup } from './FieldGroup';

export function BasicDetailsForm({ singleUpload }) {
	const { errors } = singleUpload;

	return (
		<FieldGroup
			title="Basic Details"
			description="What viewers and curators will see when they find your film on Cinemata."
		>
			<TitleField
				id="title"
				name="title"
				value={singleUpload.title}
				onChange={singleUpload.setTitle}
				error={errors.title}
				validate={[required()]}
			/>

			<SynopsisField
				id="summary"
				name="summary"
				value={singleUpload.summary}
				onChange={singleUpload.setSummary}
				error={errors.summary}
				validate={[required(), maxWords(80)]}
			/>

			<MoreInfoField
				id="description"
				name="description"
				value={singleUpload.description}
				onChange={singleUpload.setDescription}
				error={errors.description}
			/>

			<YearProducedField
				id="year_produced"
				name="year_produced"
				value={singleUpload.yearProduced}
				onChange={singleUpload.setYearProduced}
				error={errors.year_produced}
			/>
		</FieldGroup>
	);
}
