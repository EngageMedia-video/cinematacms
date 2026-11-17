import { AdminSettingsFields } from '../../../shared/components/UploadMedia';
import { FieldGroup } from './FieldGroup';

export function AdminSettingsForm({ singleUpload }) {
	return (
		<FieldGroup title="Admin Settings">
			<AdminSettingsFields
				featured={singleUpload.featured}
				onChange={(next) => singleUpload.setFeatured(next.featured)}
			/>
		</FieldGroup>
	);
}
