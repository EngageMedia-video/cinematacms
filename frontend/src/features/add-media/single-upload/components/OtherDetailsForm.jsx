import { Dialog, DialogContent, DialogTrigger, Dropdown } from '../../../shared/components';
import { Button } from '../../../shared/components/Button';
import { CheckboxButton } from '../../../shared/components/CheckboxButton';
import { CheckboxGroup } from '../../../shared/components/CheckboxGroup';
import { Text } from '../../../shared/components/Text';
import { TextField } from '../../../shared/components/TextField';
import { pattern } from '../../../shared/utils/validators';
import { FieldGroup } from './FieldGroup';

const DEFAULT_LICENSES = [];

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
	return licenses.find((license) => license.id === id) ?? null;
}

function getLicenseByFields(licenses, { commercial, derivatives }) {
	return (
		licenses.find(
			(license) => license.allowCommercial === commercial && license.allowModifications === derivatives
		) ?? null
	);
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

function LicenseChooser({ licenses, singleUpload }) {
	const defaultLicense = licenses[0] ?? null;
	const selectedLicense = getLicenseById(licenses, singleUpload.selectedLicenseId) ?? defaultLicense;
	const pendingLicense = getLicenseByFields(licenses, singleUpload.selectedLicenseFields);
	const displayTitle = singleUpload.noLicense ? '-' : (selectedLicense?.title ?? '-');

	function updateSelectedLicense() {
		if (!pendingLicense) {
			return;
		}

		singleUpload.applySelectedLicense(pendingLicense.id);
	}

	return (
		<div className="grid gap-3">
			<input
				type="hidden"
				name="custom_license"
				value={singleUpload.noLicense ? 'None' : (selectedLicense?.id ?? '')}
				readOnly
			/>

			<div>
				<span className="body-body-16-regular mb-2 block text-text-strong" id="custom-license-label">
					License
				</span>

				<div className="flex flex-col gap-3 border-b border-border-strong-constant pb-4 sm:flex-row sm:items-center sm:justify-between">
					<span
						id="custom-license-display"
						className="body-body-16-regular min-h-6 text-text-strong"
						aria-live="polite"
					>
						{displayTitle}
					</span>

					<Dialog open={singleUpload.licenseDialogOpen} onOpenChange={singleUpload.setLicenseDialogOpen}>
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
										name="field_commercial"
										options={COMMERCIAL_OPTIONS}
										selectedValue={singleUpload.selectedLicenseFields.commercial}
										onChange={(commercial) =>
											singleUpload.setSelectedLicenseField('commercial', commercial)
										}
									/>

									<LicenseRadioGroup
										legend="Allow modifications of your work?"
										name="field_derivatives"
										options={MODIFICATION_OPTIONS}
										selectedValue={singleUpload.selectedLicenseFields.derivatives}
										onChange={(derivatives) =>
											singleUpload.setSelectedLicenseField('derivatives', derivatives)
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
										onClick={() => singleUpload.setLicenseDialogOpen(false)}
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
				name="no_license"
				checked={singleUpload.noLicense}
				className="items-start"
				onChange={(event) => singleUpload.setNoLicense(event.target.checked)}
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

export function OtherDetailsForm({
	categories,
	contentSensitivities,
	licenses = DEFAULT_LICENSES,
	mediaCountries,
	mediaLanguages,
	singleUpload,
	topics,
}) {
	return (
		<FieldGroup title="Other Details">
			<TextField
				className="w-full"
				id="production-company"
				name="company"
				label="Production Company"
				placeholder="Write here..."
				value={singleUpload.company}
				onChange={(event) => singleUpload.setCompany(event.target.value)}
			/>

			<TextField
				className="w-full"
				id="website"
				name="website"
				label="Website"
				placeholder="Write here..."
				value={singleUpload.website}
				onChange={(event) => singleUpload.setWebsite(event.target.value)}
				helperText={singleUpload.errors.website}
				invalid={!!singleUpload.errors.website}
				validate={[pattern(/^https:\/\//, 'Website should start with https://')]}
			/>

			<Dropdown
				className="w-full"
				id="media_language"
				name="media_language"
				placeholder="Select media language"
				label="Media Language"
				required
				options={mediaLanguages}
				value={singleUpload.mediaLanguage}
				onChange={(value) => singleUpload.setMediaLanguage(value)}
				invalid={!!singleUpload.errors.media_language}
				helperText={singleUpload.errors.media_language}
			/>

			<Dropdown
				className="w-full"
				id="media_country"
				name="media_country"
				placeholder="Select media country"
				label="Media Country"
				required
				options={mediaCountries}
				value={singleUpload.mediaCountry}
				onChange={(value) => singleUpload.setMediaCountry(value)}
				invalid={!!singleUpload.errors.media_country}
				helperText={singleUpload.errors.media_country}
			/>

			<div className="flex flex-col sm:flex-row gap-4 mt-3">
				<CheckboxGroup
					className="flex flex-col flex-1"
					id="category"
					label="Categories"
					name="category"
					required
					options={categories}
					value={singleUpload.category}
					onChange={singleUpload.setCategory}
					error={singleUpload.errors.category}
				/>

				<CheckboxGroup
					className="flex flex-col flex-1"
					label="Content Sensitivity"
					name="content_sensitivity"
					options={contentSensitivities}
					value={singleUpload.contentSensitivity}
					onChange={singleUpload.setContentSensitivity}
				/>
			</div>

			<div className="flex flex-col sm:flex-row gap-4 mt-3">
				<CheckboxGroup
					className="flex flex-col flex-1"
					id="topics"
					label="Topics"
					name="topics"
					required
					options={topics}
					value={singleUpload.topics}
					onChange={singleUpload.setTopics}
					error={singleUpload.errors.topics}
					listClassName="grid grid-cols-1 md:grid-cols-3 max-h-50 overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:[-webkit-appearance:none] [&::-webkit-scrollbar-track]:bg-bg-surface-muted [&::-webkit-scrollbar-thumb]:bg-text-dialog-accent [&::-webkit-scrollbar-thumb]:rounded-full"
				/>
			</div>

			<TextField
				className="w-full"
				id="tags"
				name="new_tags"
				label="Tags"
				placeholder="Write here..."
				value={singleUpload.tags}
				onChange={(event) => singleUpload.setTags(event.target.value)}
				helperText="Use a comma to separate multiple tags (eq. first,second)"
			/>

			<LicenseChooser licenses={licenses} singleUpload={singleUpload} />
		</FieldGroup>
	);
}
