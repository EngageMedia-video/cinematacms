import { useMemo } from 'react';
import { TextField } from '../../TextField';
import { Dropdown } from '../../Dropdown';
import { CheckboxButton } from '../../CheckboxButton';
import { CheckboxGroup } from '../CheckboxGroup';

function toCodeOptions(items = []) {
	return items.map((item) => ({ value: item.code, label: item.title }));
}

function toIdOptions(items = []) {
	return items.map((item) => ({ value: item.id, label: item.title }));
}

export function CompanyField({ value = '', onChange }) {
	return (
		<TextField
			className="w-full"
			label="Production Company"
			placeholder="ABC Media"
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	);
}

export function WebsiteField({ value = '', onChange, error = '' }) {
	return (
		<TextField
			className="w-full"
			label="Website"
			type="url"
			placeholder="https://www.abcmedia.com"
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function MediaLanguageSelect({ value = '', onChange, options = [], error = '' }) {
	const dropdownOptions = useMemo(() => toCodeOptions(options), [options]);
	return (
		<Dropdown
			className="w-full"
			label="Media Language *"
			placeholder="Select language"
			options={dropdownOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function MediaCountrySelect({ value = '', onChange, options = [], error = '' }) {
	const dropdownOptions = useMemo(() => toCodeOptions(options), [options]);
	return (
		<Dropdown
			className="w-full"
			label="Media Country *"
			placeholder="Select country"
			options={dropdownOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function CategoryCheckboxGroup({ value = [], onChange, options = [], name, error = '' }) {
	return (
		<CheckboxGroup
			legend="Category"
			required
			name={name}
			options={useMemo(() => toIdOptions(options), [options])}
			value={value}
			onChange={onChange}
			error={error}
			helperText="Select all that apply."
		/>
	);
}

export function TopicCheckboxGroup({ value = [], onChange, options = [], name }) {
	return (
		<CheckboxGroup
			legend="Topic"
			name={name}
			options={useMemo(() => toIdOptions(options), [options])}
			value={value}
			onChange={onChange}
			helperText="Select all that apply."
		/>
	);
}

export function ContentSensitivityGroup({ value = [], onChange, options = [], name }) {
	return (
		<CheckboxGroup
			legend="Content Sensitivity"
			name={name}
			options={useMemo(() => toIdOptions(options), [options])}
			value={value}
			onChange={onChange}
			helperText="Select all that apply."
		/>
	);
}

export function TagsField({ value = '', onChange }) {
	return (
		<TextField
			className="w-full"
			label="Tags"
			placeholder="Web Series, Documentary"
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			helperText="Use a comma to separate multiple tags."
		/>
	);
}

export function LicenseSelect({ value = '', onChange, options = [], disabled = false }) {
	const dropdownOptions = useMemo(() => toIdOptions(options), [options]);
	return (
		<Dropdown
			className="w-full"
			label="License"
			placeholder="Select a license"
			options={dropdownOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			disabled={disabled}
		/>
	);
}

export function AllRightsReservedCheckbox({ checked = false, onChange }) {
	return (
		<CheckboxButton checked={checked} onChange={(event) => onChange?.(event.target.checked)}>
			All Rights Reserved
		</CheckboxButton>
	);
}
