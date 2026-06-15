import { TextField, CheckboxButton, RadioButton } from '../../../shared/components';

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'unlisted', label: 'Unlisted' },
];

export function EnableCommentsCheckbox({ checked = true, onChange }) {
	return (
		<CheckboxButton checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Enable Comments
		</CheckboxButton>
	);
}

export function AllowDownloadCheckbox({ checked = true, onChange }) {
	return (
		<CheckboxButton checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			Allow Download
		</CheckboxButton>
	);
}

export function StatusRadioGroup({ value = 'public', onChange, name }) {
	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="body-body-16-regular mb-3 p-0 text-text-strong">Status</legend>
			<div className="flex flex-wrap gap-6">
				{STATUS_OPTIONS.map((option) => (
					<RadioButton
						key={option.value}
						name={name}
						value={option.value}
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

export function RequirePasswordField({
	checked = false,
	password = '',
	onCheckedChange,
	onPasswordChange,
	error = '',
}) {
	return (
		<div className="flex flex-col gap-3">
			<CheckboxButton checked={checked} onChange={(event) => onCheckedChange?.(event.target.checked)}>
				Require Password
			</CheckboxButton>
			{checked ? (
				<TextField
					className="w-full max-w-sm"
					label="Password"
					type="password"
					value={password}
					onChange={(event) => onPasswordChange?.(event.target.value)}
					invalid={Boolean(error)}
					helperText={error || 'Restricted media requires a password.'}
					autoComplete="new-password"
				/>
			) : null}
		</div>
	);
}
