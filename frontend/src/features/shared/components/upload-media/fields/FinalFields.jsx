import { useState } from 'react';
import { TextField } from '../../TextField';
import { CheckboxButton } from '../../CheckboxButton';
import { RadioButton } from '../../RadioButton';
import { DateChooserField, formatDMY } from '../../DateChooserField';
import { Text } from '../../Text';

// Controlled twins of the single-upload FinalSettingsForm fields. Same widgets,
// labels and copy as single, driven by per-file metadata.

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'restricted', label: 'Restricted' },
	{ value: 'unlisted', label: 'Unlisted' },
];

export function EnableCommentsCheckbox({ checked = true, onChange }) {
	return (
		<CheckboxButton name="enable_comments" checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Enable Comments
		</CheckboxButton>
	);
}

export function AllowDownloadCheckbox({ checked = true, onChange }) {
	return (
		<CheckboxButton name="allow_download" checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Allow Download
		</CheckboxButton>
	);
}

export function StatusRadioGroup({ value = 'public', onChange, name, includeRestricted = true }) {
	const options = includeRestricted
		? STATUS_OPTIONS
		: STATUS_OPTIONS.filter((option) => option.value !== 'restricted');

	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="body-body-16-regular mb-2 text-text-muted">Status</legend>
			<div className="flex flex-wrap items-center gap-6">
				{options.map((option) => (
					<RadioButton
						key={option.value}
						name={name}
						value={option.value}
						controlClassName="bg-bg-surface-hover"
						checked={value === option.value}
						onChange={() => onChange?.(option.value)}
					>
						{option.label}
					</RadioButton>
				))}
			</div>
		</fieldset>
	);
}

function todayIso() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${month}-${day}`;
}

function diffInDays(startIso, endIso) {
	const start = new Date(startIso);
	const end = new Date(endIso);
	return Math.max(0, Math.ceil((end - start) / 86400000));
}

export function VisibilityExpirationField({
	expireEnabled = false,
	startDate = '',
	endDate = '',
	onToggle,
	onStartDateChange,
	onEndDateChange,
	idPrefix = 'visibility',
}) {
	const effectiveStart = startDate || todayIso();
	// Backend treats end date as inclusive (+1 day in forms.py), so add 1 to
	// match: same start and end date = a valid 1-day window, not 0 days.
	const visibleDays = endDate ? diffInDays(effectiveStart, endDate) + 1 : 0;

	return (
		<>
			<CheckboxButton checked={expireEnabled} onChange={(event) => onToggle?.(event.target.checked)}>
				Set Visibility Expiration
			</CheckboxButton>

			{expireEnabled ? (
				<>
					<div className="flex flex-col gap-4 sm:flex-row">
						<DateChooserField
							id={`${idPrefix}_start`}
							name="visibility_start"
							label="Enter Start Date"
							value={startDate}
							onChange={onStartDateChange}
						/>
						<DateChooserField
							id={`${idPrefix}_end`}
							name="visibility_end"
							label="Enter End Date"
							value={endDate}
							min={startDate || todayIso()}
							onChange={onEndDateChange}
						/>
					</div>

					{endDate ? (
						<Text variant="body-14" color="meta" className="m-0">
							Your film will be visible for {visibleDays} days, starting {formatDMY(effectiveStart)} to{' '}
							{formatDMY(endDate)}
						</Text>
					) : null}
				</>
			) : null}
		</>
	);
}

export function RestrictedPasswordField({
	password = '',
	onPasswordChange,
	error = '',
	id = 'restricted-password',
	name = 'password',
}) {
	const [showPassword, setShowPassword] = useState(false);

	return (
		<TextField
			className="w-full"
			id={id}
			name="password"
			label="Enter Password"
			placeholder="Write here..."
			type={showPassword ? 'text' : 'password'}
			value={password}
			onChange={(event) => onPasswordChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error || ''}
			autoComplete="new-password"
			rightButtonLabel={showPassword ? 'Hide' : 'Show'}
			onRightButtonClick={() => setShowPassword((visible) => !visible)}
		/>
	);
}

export function StreamProtectionField({ checked = true, onChange }) {
	return (
		<div>
			<span className="body-body-16-regular mb-2 block text-text-muted">Stream Protection</span>
			<div className="flex flex-row items-start gap-2">
				<CheckboxButton
					name="is_encrypted"
					aria-label="Encrypt this video's stream"
					className="mt-0.5"
					checked={checked}
					onChange={(event) => onChange?.(event.target.checked)}
				/>
				<div className="flex flex-col gap-2">
					<Text className="m-0" variant="body-16">
						Encrypt this video's stream
					</Text>
					<Text className="m-0" variant="body-12">
						Adds an extra layer of protection so only authorized viewers can watch this film. If your video
						has already been processed, enabling this will trigger a re-encoding, which may take a few
						minutes.
					</Text>
				</div>
			</div>
		</div>
	);
}
