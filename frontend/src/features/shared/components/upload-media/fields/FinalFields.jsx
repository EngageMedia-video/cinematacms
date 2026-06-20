import { useState } from 'react';
import { TextField } from '../../TextField';
import { CheckboxButton } from '../../CheckboxButton';
import { RadioButton } from '../../RadioButton';

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'unlisted', label: 'Unlisted' },
	{ value: 'restricted', label: 'Restricted' },
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

export function StatusRadioGroup({ value = 'public', onChange, name, includeRestricted = true }) {
	const options = includeRestricted
		? STATUS_OPTIONS
		: STATUS_OPTIONS.filter((option) => option.value !== 'restricted');

	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="body-body-16-regular mb-3 p-0 text-text-strong">Status</legend>
			<div className="flex flex-wrap gap-6">
				{options.map((option) => (
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
			className="w-full max-w-sm"
			id={id}
			name={name}
			label="Password"
			type={showPassword ? 'text' : 'password'}
			value={password}
			onChange={(event) => onPasswordChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error || 'Restricted media requires a password.'}
			autoComplete="new-password"
			rightButtonLabel={showPassword ? 'Hide' : 'Show'}
			onRightButtonClick={() => setShowPassword((visible) => !visible)}
		/>
	);
}
