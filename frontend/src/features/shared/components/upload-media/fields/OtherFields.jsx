import { useMemo, useState } from 'react';
import { pattern } from '../../../utils/validators';
import { TextField } from '../../TextField';
import { Dropdown } from '../../Dropdown';
import { CheckboxButton } from '../../CheckboxButton';
import { CheckboxGroup } from '../../CheckboxGroup';
import { Dialog, DialogContent, DialogTrigger } from '../../Dialog';
import { Button } from '../../Button';
import { Text } from '../../Text';

// Controlled twins of the single-upload OtherDetailsForm fields. Same widgets,
// labels and CC license chooser as single, driven by per-file metadata.

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
			placeholder="Write here..."
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
			placeholder="Write here..."
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			validate={[pattern(/^https:\/\//, 'Website should start with https://')]}
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
			label="Media Language"
			required
			placeholder="Select media language"
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
			label="Media Country"
			required
			placeholder="Select media country"
			options={dropdownOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			invalid={Boolean(error)}
			helperText={error}
		/>
	);
}

export function CategoryCheckboxGroup({ value = [], onChange, options = [], name, error = '' }) {
	const groupOptions = useMemo(() => toIdOptions(options), [options]);
	return (
		<CheckboxGroup
			className="flex flex-col flex-1"
			label="Categories"
			required
			name={name}
			options={groupOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			error={error}
		/>
	);
}

export function ContentSensitivityGroup({ value = [], onChange, options = [], name }) {
	const groupOptions = useMemo(() => toIdOptions(options), [options]);
	return (
		<CheckboxGroup
			className="flex flex-col flex-1"
			label="Content Sensitivity"
			name={name}
			options={groupOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
		/>
	);
}

export function TopicCheckboxGroup({ value = [], onChange, options = [], name, error = '' }) {
	const groupOptions = useMemo(() => toIdOptions(options), [options]);
	return (
		<CheckboxGroup
			className="flex flex-col flex-1"
			label="Topics"
			required
			name={name}
			options={groupOptions}
			value={value}
			onChange={(next) => onChange?.(next)}
			error={error}
			listClassName="grid grid-cols-1 md:grid-cols-3 max-h-50 overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:[-webkit-appearance:none] [&::-webkit-scrollbar-track]:bg-bg-surface-muted [&::-webkit-scrollbar-thumb]:bg-text-dialog-accent [&::-webkit-scrollbar-thumb]:rounded-full"
		/>
	);
}

export function TagsField({ value = '', onChange }) {
	return (
		<TextField
			className="w-full"
			label="Tags"
			placeholder="Write here..."
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			helperText="Use a comma to separate multiple tags (eq. first,second)"
		/>
	);
}

const COMMERCIAL_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'no', label: 'No' },
];

const MODIFICATION_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'sharealike', label: 'Yes, as long as others share alike' },
	{ value: 'no', label: 'No' },
];

function getLicenseById(licenses, id) {
	return licenses.find((license) => String(license.id) === String(id)) ?? null;
}

function getLicenseByFields(licenses, { commercial, derivatives }) {
	return (
		licenses.find(
			(license) => license.allowCommercial === commercial && license.allowModifications === derivatives
		) ?? null
	);
}

function fieldsFromLicense(license) {
	return {
		commercial: license?.allowCommercial ?? 'yes',
		derivatives: license?.allowModifications ?? 'yes',
	};
}

function LicenseRadioGroup({ legend, name, options, selectedValue, onChange }) {
	return (
		<fieldset className="m-0 border-0 p-0">
			<legend className="body-body-16-bold m-0 mb-3 text-text-strong">{legend}</legend>
			<div className="grid gap-2">
				{options.map((option) => (
					<label
						key={option.value}
						className="flex cursor-pointer items-start gap-3 rounded-ds-4 border border-border-subtle bg-bg-surface px-4 py-3 transition-colors hover:bg-bg-surface-hover"
					>
						<input
							type="radio"
							name={name}
							value={option.value}
							checked={selectedValue === option.value}
							aria-label={`${legend} ${option.label}`}
							className="mt-1 h-4 w-4 accent-current"
							onChange={() => onChange(option.value)}
						/>
						<span className="body-body-14-regular text-text-strong">{option.label}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

/**
 * Creative Commons license chooser, mirroring the single-upload LicenseChooser
 * but controlled by per-file metadata. The user picks a license by answering the
 * commercial/modifications questions; "All Rights Reserved" clears the license.
 * Emits `{ custom_license, no_license }` patches.
 */
export function LicenseChooser({ value = '', noLicense = false, options = [], onChange, name = 'license' }) {
	const defaultLicense = options[0] ?? null;
	const selectedLicense = getLicenseById(options, value) ?? defaultLicense;

	const [dialogOpen, setDialogOpen] = useState(false);
	// Radios reflect the current license; re-synced each time the dialog opens so
	// it never shows stale defaults.
	const [pendingFields, setPendingFields] = useState(() => fieldsFromLicense(selectedLicense));
	const pendingLicense = getLicenseByFields(options, pendingFields);
	const displayTitle = noLicense ? '-' : (selectedLicense?.title ?? '-');

	function handleOpenChange(open) {
		if (open) {
			setPendingFields(fieldsFromLicense(selectedLicense));
		}
		setDialogOpen(open);
	}

	function updateSelectedLicense() {
		if (!pendingLicense) {
			return;
		}
		onChange?.({ custom_license: String(pendingLicense.id), no_license: false });
		setDialogOpen(false);
	}

	return (
		<div className="grid gap-3">
			<div>
				<span className="body-body-16-regular mb-2 block text-text-strong">License</span>

				<div className="flex flex-col gap-3 border-b border-border-strong-constant pb-4 sm:flex-row sm:items-center sm:justify-between">
					<span className="body-body-16-regular min-h-6 text-text-strong" aria-live="polite">
						{displayTitle}
					</span>

					<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
						<DialogTrigger>
							<Button type="button" variant="text" className="text-text-accent">
								Choose License
							</Button>
						</DialogTrigger>

						<DialogContent
							aria-label="Choose Creative Commons license"
							className="w-full max-w-[720px] overflow-hidden rounded-[8px] bg-bg-surface text-left shadow-2xl"
						>
							<div className="max-h-[calc(100vh-2rem)] overflow-y-auto p-6 sm:p-8">
								<div className="flex flex-col gap-2">
									<Text variant="h5" as="h2" className="m-0 text-text-strong">
										Choose Creative Commons License
									</Text>
									<Text variant="body-14" color="meta" className="m-0">
										Creative Commons licenses help you share your work while keeping your copyright.
										Others can copy and distribute your work with attribution and the conditions you
										specify here.
									</Text>
								</div>

								<div className="mt-6 grid gap-6">
									<LicenseRadioGroup
										legend="Allow commercial uses of your work?"
										name={`${name}-commercial`}
										options={COMMERCIAL_OPTIONS}
										selectedValue={pendingFields.commercial}
										onChange={(commercial) => setPendingFields((prev) => ({ ...prev, commercial }))}
									/>

									<LicenseRadioGroup
										legend="Allow modifications of your work?"
										name={`${name}-derivatives`}
										options={MODIFICATION_OPTIONS}
										selectedValue={pendingFields.derivatives}
										onChange={(derivatives) =>
											setPendingFields((prev) => ({ ...prev, derivatives }))
										}
									/>
								</div>

								<div className="mt-6 rounded-[8px] bg-bg-surface-muted p-4">
									<Text variant="body-14-bold" as="p" className="m-0 text-text-strong">
										{pendingLicense?.title ?? 'Select a license option'}
									</Text>
									<Text variant="body-12" color="meta" className="m-0 mt-1">
										To license a work, you must be its copyright holder or have express
										authorization from its copyright holder to do so.
									</Text>
								</div>

								<div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
									<Button
										type="button"
										variant="secondary-outline"
										onClick={() => setDialogOpen(false)}
									>
										Cancel
									</Button>
									<Button type="button" onClick={updateSelectedLicense} disabled={!pendingLicense}>
										Update License
									</Button>
								</div>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			<CheckboxButton
				checked={noLicense}
				className="items-start"
				onChange={(event) =>
					onChange?.({ no_license: event.target.checked, custom_license: event.target.checked ? '' : value })
				}
				controlClassName="bg-bg-control-unchecked peer-checked:bg-bg-control-checked"
			>
				<span>
					<span className="body-body-16-regular block text-text-strong">All Rights Reserved</span>
					<span className="body-body-12-regular block text-text-muted">
						Use this when you do not want to apply a Creative Commons license.
					</span>
				</span>
			</CheckboxButton>
		</div>
	);
}
