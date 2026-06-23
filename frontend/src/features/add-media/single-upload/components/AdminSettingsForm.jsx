import { CheckboxButton } from '../../../shared/components/CheckboxButton';
import { TextField } from '../../../shared/components/TextField';
import { FieldGroup } from './FieldGroup';

export function AdminSettingsForm({ singleUpload }) {
	return (
		<FieldGroup title="Admin Settings">
			<div className="flex flex-col gap-5">
				<CheckboxButton
					name="featured"
					checked={singleUpload.featured}
					onChange={(event) => singleUpload.setFeatured(event.target.checked)}
				>
					Featured
				</CheckboxButton>

				<TextField
					className="w-full max-w-sm"
					id="reported_times"
					name="reported_times"
					type="number"
					label="Reported Times"
					value={singleUpload.reportedTimes}
					onChange={(event) => singleUpload.setReportedTimes(event.target.value)}
					min="0"
					step="1"
					required
				/>
			</div>
		</FieldGroup>
	);
}
