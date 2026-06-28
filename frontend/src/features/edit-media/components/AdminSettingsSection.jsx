import { FieldGroup } from '../../add-media/single-upload/components/FieldGroup';
import { CheckboxButton } from '../../shared/components/CheckboxButton';
import { TextField } from '../../shared/components/TextField';

export function AdminSettingsSection({ config, editState }) {
	if (!config.permissions?.canUseAdminSettings) {
		return null;
	}

	return (
		<FieldGroup title="Admin Settings">
			<div className="grid gap-5">
				{config.fields?.includes('featured') ? (
					<CheckboxButton
						name="featured"
						checked={editState.featured}
						onChange={(event) => editState.setFeatured(event.target.checked)}
					>
						Featured
					</CheckboxButton>
				) : null}
				{config.fields?.includes('is_reviewed') ? (
					<CheckboxButton
						name="is_reviewed"
						checked={editState.isReviewed}
						onChange={(event) => editState.setIsReviewed(event.target.checked)}
					>
						Reviewed
					</CheckboxButton>
				) : null}
				{config.fields?.includes('reported_times') ? (
					<TextField
						className="w-full max-w-sm"
						id="reported_times"
						name="reported_times"
						type="number"
						label="Reported Times"
						value={editState.reportedTimes}
						onChange={(event) => editState.setReportedTimes(event.target.value)}
						min="0"
						step="1"
					/>
				) : null}
				{config.fields?.includes('add_date') ? (
					<TextField
						className="w-full max-w-sm"
						id="add_date"
						name="add_date"
						label="Publication Date"
						value={editState.addDate}
						onChange={(event) => editState.setAddDate(event.target.value)}
					/>
				) : null}
			</div>
		</FieldGroup>
	);
}
