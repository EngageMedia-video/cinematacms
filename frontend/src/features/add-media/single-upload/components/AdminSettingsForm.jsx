import { AdminSettingsFields } from '../../../shared/components/UploadMedia';
import { FieldGroup } from './FieldGroup';

export function AdminSettingsForm({ singleUpload }) {
	function handleChange(next) {
		if (Object.prototype.hasOwnProperty.call(next, 'featured')) {
			singleUpload.setFeatured(next.featured);
		}

		if (Object.prototype.hasOwnProperty.call(next, 'reported_times')) {
			singleUpload.setReportedTimes(next.reported_times);
		}
	}

	return (
		<FieldGroup title="Admin Settings">
			<AdminSettingsFields
				featured={singleUpload.featured}
				reportedTimes={singleUpload.reportedTimes}
				reportedTimesId="reported_times"
				onChange={handleChange}
			/>
		</FieldGroup>
	);
}
