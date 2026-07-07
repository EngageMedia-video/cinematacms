import { CheckboxButton } from '../../CheckboxButton';
import { TextField } from '../../TextField';

// Controlled admin-only fields shared by single upload and bulk per-file
// metadata forms.

export function FeaturedCheckbox({ checked = false, onChange, name = 'featured' }) {
	return (
		<CheckboxButton name={name} checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Featured
		</CheckboxButton>
	);
}

export function ReportedTimesField({ value = '0', onChange, id, idPrefix = 'admin', name = 'reported_times' }) {
	const fieldId = id ?? (idPrefix ? `${idPrefix}-reported_times` : 'reported_times');

	return (
		<TextField
			className="w-full max-w-sm"
			id={fieldId}
			name={name}
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

export function AdminSettingsFields({
	featured = false,
	reportedTimes = '0',
	onChange,
	idPrefix = 'admin',
	featuredName = 'featured',
	reportedTimesId,
	reportedTimesName = 'reported_times',
}) {
	return (
		<div className="flex flex-col gap-5">
			<FeaturedCheckbox
				name={featuredName}
				checked={featured}
				onChange={(next) => onChange?.({ featured: next })}
			/>
			<ReportedTimesField
				id={reportedTimesId}
				idPrefix={idPrefix}
				name={reportedTimesName}
				value={reportedTimes}
				onChange={(next) => onChange?.({ reported_times: next })}
			/>
		</div>
	);
}
