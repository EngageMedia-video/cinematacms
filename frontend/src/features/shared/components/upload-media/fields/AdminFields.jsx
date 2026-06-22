import { CheckboxButton } from '../../CheckboxButton';
import { TextField } from '../../TextField';

// Controlled twins of the single-upload AdminSettingsForm fields (admin-only),
// driven by per-file metadata.

export function FeaturedCheckbox({ checked = false, onChange }) {
	return (
		<CheckboxButton name="featured" checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Featured
		</CheckboxButton>
	);
}

export function ReportedTimesField({ value = '0', onChange }) {
	return (
		<TextField
			className="w-full max-w-sm"
			id="reported_times"
			name="reported_times"
			type="number"
			label="Reported Times"
			min="0"
			step="1"
			required
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	);
}

export function AdminSettingsFields({ featured = false, reportedTimes = '0', onChange }) {
	return (
		<div className="flex flex-col gap-5">
			<FeaturedCheckbox checked={featured} onChange={(next) => onChange?.({ featured: next })} />
			<ReportedTimesField value={reportedTimes} onChange={(next) => onChange?.({ reported_times: next })} />
		</div>
	);
}
