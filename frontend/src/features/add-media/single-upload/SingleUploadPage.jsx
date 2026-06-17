import { useRef, useState } from 'react';
import {
	Card,
	ConfirmationDialogContent,
	DateChooserField,
	Dialog,
	DialogContent,
	DialogTrigger,
	Dropdown,
	RadioButton,
	TabContent,
	TabView,
	TextAlert,
} from '../../shared/components';
import { Button } from '../../shared/components/Button';
import { CheckboxButton } from '../../shared/components/CheckboxButton';
import { EditorField } from '../../shared/components/EditorField';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { Text } from '../../shared/components/Text';
import { TextField } from '../../shared/components/TextField';
import { maxWords, required, runValidators } from '../../shared/utils/validators';

const CURRENT_YEAR = new Date().getFullYear();

const DESCRIPTION_FIELDS = [
	{
		id: 'title',
		label: 'Title',
		placeholder: 'Write here...',
	},
	{
		id: 'summary',
		label: 'Synopsis',
		placeholder: 'Write here...',
		helperText: 'Maximum 60 Words',
		required: true,
		multiline: true,
		validate: [required(), maxWords(60)],
	},
	{
		id: 'description',
		label: 'More Information and Credits',
		placeholder: 'Write here...',
		multiline: true,
	},
	{
		id: 'year_produced',
		label: 'Year Produced',
		placeholder: 'Write here...',
		required: true,
		validate: [required()],
	},
];

const LICENSES = [
	{
		id: '1',
		title: 'CC BY 4.0 - Attribution',
		allowCommercial: 'yes',
		allowModifications: 'yes',
	},
	{
		id: '2',
		title: 'CC BY-SA 4.0 - Attribution-ShareAlike',
		allowCommercial: 'yes',
		allowModifications: 'sharealike',
	},
	{
		id: '3',
		title: 'CC BY-NC 4.0 - Attribution-NonCommercial',
		allowCommercial: 'no',
		allowModifications: 'yes',
	},
	{
		id: '4',
		title: 'CC BY-NC-SA 4.0 - Attribution-NonCommercial-ShareAlike',
		allowCommercial: 'no',
		allowModifications: 'sharealike',
	},
	{
		id: '5',
		title: 'CC BY-ND 4.0 - Attribution-NoDerivatives',
		allowCommercial: 'yes',
		allowModifications: 'no',
	},
	{
		id: '6',
		title: 'CC BY-NC-ND 4.0 - Attribution-NonCommercial-NoDerivatives',
		allowCommercial: 'no',
		allowModifications: 'no',
	},
];

const COMMERCIAL_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'no', label: 'No' },
];

const MODIFICATION_OPTIONS = [
	{ value: 'yes', label: 'Yes' },
	{ value: 'sharealike', label: 'Yes, as long as others share alike' },
	{ value: 'no', label: 'No' },
];

const STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'unlisted', label: 'Unlisted' },
];

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

function FieldGroup({ children, description, title }) {
	return (
		<Card className="py-8 px-6">
			<Text variant="h6-medium" as="h2" className="m-0 text-text-strong">
				{title}
			</Text>

			{description ? (
				<Text variant="body-14" color="meta" className="m-0 mt-2">
					{description}
				</Text>
			) : null}

			<div className="my-6 border-b border-b-border-divider" />

			<div className="grid gap-5">{children}</div>
		</Card>
	);
}

function getLicenseById(id) {
	return LICENSES.find((license) => license.id === id) ?? null;
}

function getLicenseByFields({ commercial, derivatives }) {
	return (
		LICENSES.find(
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

function LicenseChooser() {
	const defaultLicense = LICENSES[0];
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [noLicense, setNoLicense] = useState(true);
	const [selectedLicenseId, setSelectedLicenseId] = useState(defaultLicense.id);
	const [selectedFields, setSelectedFields] = useState({
		commercial: defaultLicense.allowCommercial,
		derivatives: defaultLicense.allowModifications,
	});
	const selectedLicense = getLicenseById(selectedLicenseId) ?? defaultLicense;
	const pendingLicense = getLicenseByFields(selectedFields);
	const displayTitle = noLicense ? '-' : selectedLicense.title;

	function updateSelectedLicense() {
		if (!pendingLicense) {
			return;
		}

		setSelectedLicenseId(pendingLicense.id);
		setNoLicense(false);
		setIsDialogOpen(false);
	}

	return (
		<div className="grid gap-3">
			<input type="hidden" name="custom_license" value={noLicense ? 'None' : selectedLicense.id} readOnly />

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

					<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
						<DialogTrigger>
							<Button type="button" variant="secondary-outline" size="sm">
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
										selectedValue={selectedFields.commercial}
										onChange={(commercial) =>
											setSelectedFields((current) => ({ ...current, commercial }))
										}
									/>

									<LicenseRadioGroup
										legend="Allow modifications of your work?"
										name="field_derivatives"
										options={MODIFICATION_OPTIONS}
										selectedValue={selectedFields.derivatives}
										onChange={(derivatives) =>
											setSelectedFields((current) => ({ ...current, derivatives }))
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
										onClick={() => setIsDialogOpen(false)}
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
				checked={noLicense}
				className="items-start"
				onChange={(event) => setNoLicense(event.target.checked)}
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

function MediaDetailsForm({
	canPublishDirectly = false,
	categories = [],
	contentSensitivities = [],
	csrfToken = '',
	editUrl = '',
	mediaCountries = [],
	mediaLanguages = [],
	topics = [],
}) {
	const formRef = useRef(null);
	const [allowDownload, setAllowDownload] = useState(false);
	// Per-field required-field errors, keyed by form field name.
	const [errors, setErrors] = useState({});
	// Top-level message shown when the server rejects the submission.
	const [submitError, setSubmitError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	// Share Media confirmation gate: null | 'download' | 'review'.
	const [shareStage, setShareStage] = useState(null);
	const [lastSelectedThumbnailFile, setLastSelectedThumbnailFile] = useState('');
	const [mediaStatus, setMediaStatus] = useState('public');
	const [requirePassword, setRequirePassword] = useState(false);
	const [isEditingPassword, setIsEditingPassword] = useState(false);
	const [passwordDraft, setPasswordDraft] = useState('');
	const [savedPassword, setSavedPassword] = useState('');

	function savePassword() {
		setSavedPassword(passwordDraft);
		setIsEditingPassword(false);
	}

	function toggleRequirePassword(event) {
		const { checked } = event.target;
		setRequirePassword(checked);
		// Reset the editor + stored value whenever the requirement is turned off.
		if (!checked) {
			setIsEditingPassword(false);
			setPasswordDraft('');
			setSavedPassword('');
		}
	}

	const [expireEnabled, setExpireEnabled] = useState(false);
	const [startDate, setStartDate] = useState('');
	const [endDate, setEndDate] = useState('');

	function toggleExpire(event) {
		const { checked } = event.target;
		setExpireEnabled(checked);
		if (!checked) {
			setStartDate('');
			setEndDate('');
		}
	}

	// Start defaults to "now" when left blank.
	const effectiveStart = startDate || todayIso();
	const visibleDays = endDate ? diffInDays(effectiveStart, endDate) : 0;

	function onFileChanged(files) {
		const [file] = files;
		setLastSelectedThumbnailFile(file?.name ?? '');
	}

	// Required fields the backend rejects when empty. Keeping this in sync with
	// MediaForm avoids a server round-trip that navigates away from this page.
	function validateForm() {
		const form = formRef.current;

		if (!form) {
			return {};
		}

		const data = new FormData(form);
		const nextErrors = {};

		// Synopsis: required, max 60 words (backend clean_summary enforces 60).
		const summaryError = runValidators([required(), maxWords(60)], data.get('summary'));
		if (summaryError) {
			nextErrors.summary = summaryError;
		}

		// Year Produced: backend expects an integer between 2000 and the current year.
		const year = String(data.get('year_produced') ?? '').trim();
		if (!year) {
			nextErrors.year_produced = 'This field is required';
		} else if (!/^\d+$/.test(year) || Number(year) < 2000 || Number(year) > CURRENT_YEAR) {
			nextErrors.year_produced = `Enter a year between 2000 and ${CURRENT_YEAR}`;
		}

		// Website is optional, but must start with https:// when provided.
		const website = String(data.get('website') ?? '').trim();
		if (website && !website.startsWith('https://')) {
			nextErrors.website = 'Website should start with https://';
		}

		if (!String(data.get('media_language') ?? '').trim()) {
			nextErrors.media_language = 'Select a media language';
		}

		if (!String(data.get('media_country') ?? '').trim()) {
			nextErrors.media_country = 'Select a media country';
		}

		if (data.getAll('category').length === 0) {
			nextErrors.category = 'Select at least one category';
		}

		if (data.getAll('topics').length === 0) {
			nextErrors.topics = 'Select at least one topic';
		}

		return nextErrors;
	}

	// Submit over fetch instead of a native form POST so a server-side validation
	// failure keeps the user on this page (with an alert) instead of navigating
	// to the rendered edit-media page.
	async function submitMedia() {
		setShareStage(null);

		const form = formRef.current;

		if (!form || isSubmitting) {
			return;
		}

		setIsSubmitting(true);
		setSubmitError('');

		try {
			const response = await fetch(form.action, {
				method: 'POST',
				body: new FormData(form),
				credentials: 'same-origin',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
			});

			const data = await response.json().catch(() => null);

			if (response.ok && data?.success) {
				window.location.assign(data.url);
				return;
			}

			// Map server-side MediaForm errors onto their fields + a summary banner.
			if (data?.errors) {
				const fieldErrors = {};
				const messages = [];

				for (const [field, value] of Object.entries(data.errors)) {
					const text = Array.isArray(value) ? value.join(' ') : String(value);
					fieldErrors[field] = text;
					messages.push(field === '__all__' ? text : `${field}: ${text}`);
				}

				setErrors(fieldErrors);
				setSubmitError(messages.join(' • ') || 'Please review your inputs and try again.');
				return;
			}

			throw new Error(`Unexpected response: ${response.status}`);
		} catch (error) {
			console.warn('Failed to share media', error);
			setSubmitError('Something went wrong while sharing your media. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	}

	// Trusted users (advancedUser/editor/manager/superuser) publish immediately;
	// regular users must acknowledge the admin review first.
	function postOrReview() {
		if (canPublishDirectly) {
			submitMedia();
		} else {
			setShareStage('review');
		}
	}

	function handleShareClick() {
		setSubmitError('');
		const nextErrors = validateForm();
		setErrors(nextErrors);

		// Block the share flow and keep the user on the page while anything is missing.
		if (Object.keys(nextErrors).length > 0) {
			const firstInvalid = formRef.current?.querySelector('[aria-invalid="true"]');
			firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		// Allowing downloads needs an explicit heads-up before anything else.
		if (allowDownload) {
			setShareStage('download');
		} else {
			postOrReview();
		}
	}

	return (
		<>
			<form
				ref={formRef}
				action={editUrl || undefined}
				method="post"
				encType="multipart/form-data"
				className="mt-10 flex flex-col gap-8"
				data-single-upload-form
			>
				<input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
				{/* Editors/managers keep MediaForm's required moderation field; a new
				    upload always starts at zero reports. Regular users never see it. */}
				<input type="hidden" name="reported_times" value="0" />
				<FieldGroup
					title="Basic Details"
					description="Add the information viewers and editors need before this media is published."
				>
					{DESCRIPTION_FIELDS.map((field) =>
						field.multiline ? (
							<EditorField
								key={field.id}
								className="w-full"
								id={field.id}
								name={field.id}
								label={field.label}
								required={field.required}
								placeholder={field.placeholder}
								helperText={errors[field.id] || field.helperText}
								invalid={!!errors[field.id]}
								validate={field.validate}
							/>
						) : (
							<TextField
								key={field.id}
								className="w-full"
								id={field.id}
								name={field.id}
								label={field.label}
								placeholder={field.placeholder}
								helperText={errors[field.id] || field.helperText}
								invalid={!!errors[field.id]}
								required={field.required}
								validate={field.validate}
							/>
						)
					)}
				</FieldGroup>

				<FieldGroup
					title="Thumbnail Image Upload"
					description="This image will display when your video isn’t autoplaying. You can select an auto-generated image, upload a custom image or choose a still frame from your video."
				>
					<div>
						<TabView
							tabMode="wrap"
							triggerClassName="rounded-none py-3 px-size-22 text-neutral-50 aria-selected:text-text-primary aria-selected:text-neutral-50"
							panelClassName="mt-8"
							aria-label="Upload media type"
							defaultSelectedTab="single-film-upload"
						>
							<TabContent title="UPLOAD THUMBNAIL" value="upload-thumbnail">
								<MediaDropzone
									accept="image/*"
									buttonVariant="secondary"
									iconName={null}
									multiple={false}
									name="thumbnail"
									aria-label="Choose thumbnail image"
									onFilesSelected={onFileChanged}
								/>

								{lastSelectedThumbnailFile ? (
									<Text variant="body-14" className="m-0 mt-4 text-cinemata-pacific-deep-300">
										Last selected: {lastSelectedThumbnailFile}
									</Text>
								) : null}
							</TabContent>
							<TabContent title="CHOOSE FROM VIDEO" value="choose-from-video">
								<p>Choose from video</p>
							</TabContent>
						</TabView>
					</div>
				</FieldGroup>

				<FieldGroup title="Others Details">
					<TextField
						className="w-full"
						id="production-company"
						name="company"
						label="Production Company"
						placeholder="Write here..."
					/>

					<TextField
						className="w-full"
						id="website"
						name="website"
						label="Website"
						placeholder="Write here..."
						helperText={errors.website}
						invalid={!!errors.website}
					/>

					<Dropdown
						className="w-full"
						name="media_language"
						placeholder="Select media language"
						label="Media Language"
						options={mediaLanguages}
						invalid={!!errors.media_language}
						helperText={errors.media_language}
					/>

					<Dropdown
						className="w-full"
						name="media_country"
						placeholder="Select media country"
						label="Media Country"
						options={mediaCountries}
						invalid={!!errors.media_country}
						helperText={errors.media_country}
					/>

					<div className="flex flex-col sm:flex-row gap-4 mt-3">
						<div className="flex flex-col flex-1">
							<label className="body-body-16-regular mb-2 text-text-muted">
								Categories
								<span className="text-text-danger"> *</span>
							</label>

							<div className="flex flex-col max-h-40 overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:[-webkit-appearance:none] [&::-webkit-scrollbar-track]:bg-bg-surface-muted [&::-webkit-scrollbar-thumb]:bg-text-dialog-accent [&::-webkit-scrollbar-thumb]:rounded-full">
								{categories.map((option) => (
									<CheckboxButton key={option.value} name="category" value={option.value}>
										{option.label}
									</CheckboxButton>
								))}
							</div>

							{errors.category ? (
								<p className="body-body-12-regular mt-2 mb-0 text-text-danger">{errors.category}</p>
							) : null}
						</div>

						<div className="flex flex-col flex-1">
							<label className="body-body-16-regular mb-2 text-text-muted">Content Sensitivity</label>

							<div className="flex flex-col max-h-40 overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:[-webkit-appearance:none] [&::-webkit-scrollbar-track]:bg-bg-surface-muted [&::-webkit-scrollbar-thumb]:bg-text-dialog-accent [&::-webkit-scrollbar-thumb]:rounded-full">
								{contentSensitivities.map((option) => (
									<CheckboxButton key={option.value} name="content_sensitivity" value={option.value}>
										{option.label}
									</CheckboxButton>
								))}
							</div>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row gap-4 mt-3">
						<div className="flex flex-col flex-1">
							<label className="body-body-16-regular mb-2 text-text-muted">
								Topics
								<span className="text-text-danger"> *</span>
							</label>

							<div className="grid grid-cols-1 md:grid-cols-3">
								{topics.map((option) => (
									<CheckboxButton key={option.value} name="topics" value={option.value}>
										{option.label}
									</CheckboxButton>
								))}
							</div>

							{errors.topics ? (
								<p className="body-body-12-regular mt-2 mb-0 text-text-danger">{errors.topics}</p>
							) : null}
						</div>
					</div>

					<TextField
						className="w-full"
						id="tags"
						name="new_tags"
						label="Tags"
						placeholder="Write here..."
						helperText="Use a comma to separate multiple tags (eq. first,second)"
					/>

					<LicenseChooser />
				</FieldGroup>

				<FieldGroup title="Final Settings">
					<div className="flex flex-col">
						<CheckboxButton name="enable_comments">Enable Comments</CheckboxButton>

						<CheckboxButton
							name="allow_download"
							checked={allowDownload}
							onChange={(event) => setAllowDownload(event.target.checked)}
						>
							Allow Download
						</CheckboxButton>

						<div className="my-4 border-b border-b-border-divider" />

						<fieldset className="m-0 border-0 p-0">
							<legend className="body-body-16-regular mb-2 text-text-muted">Status</legend>
							<div className="flex flex-wrap items-center gap-6">
								{STATUS_OPTIONS.map((option) => (
									<RadioButton
										key={option.value}
										name="state"
										value={option.value}
										controlClassName="bg-bg-surface-hover"
										checked={mediaStatus === option.value}
										onChange={() => setMediaStatus(option.value)}
									>
										{option.label}
									</RadioButton>
								))}
							</div>
						</fieldset>

						<div className="my-4 border-b border-b-border-divider" />

						<div className="flex items-center justify-between gap-4">
							<CheckboxButton checked={requirePassword} onChange={toggleRequirePassword}>
								Require Password
							</CheckboxButton>

							{requirePassword && !isEditingPassword ? (
								<Button
									variant="text"
									className="body-body-14-bold uppercase text-text-accent"
									onClick={() => {
										setPasswordDraft(savedPassword);
										setIsEditingPassword(true);
									}}
								>
									Edit Password
								</Button>
							) : null}
						</div>

						{requirePassword && isEditingPassword ? (
							<TextField
								className="w-full"
								id="password"
								name="password"
								type="text"
								label="Enter Password"
								placeholder="Write here..."
								value={passwordDraft}
								onChange={(event) => setPasswordDraft(event.target.value)}
								rightButtonLabel="Save"
								onRightButtonClick={savePassword}
							/>
						) : null}

						{requirePassword && !isEditingPassword ? (
							<input type="hidden" name="password" value={savedPassword} readOnly />
						) : null}

						<div className="my-4 border-b border-b-border-divider" />

						<CheckboxButton checked={expireEnabled} onChange={toggleExpire}>
							Set Visibility Expiration
						</CheckboxButton>

						{expireEnabled ? (
							<>
								<div className="flex flex-col gap-4 sm:flex-row">
									<DateChooserField
										id="visibility_start"
										name="visibility_start"
										label="Enter Start Date"
										value={startDate}
										onChange={setStartDate}
									/>

									<DateChooserField
										id="visibility_end"
										name="visibility_end"
										label="Enter End Date"
										value={endDate}
										min={startDate || todayIso()}
										onChange={setEndDate}
									/>
								</div>

								{endDate ? (
									<Text variant="body-14" color="meta" className="m-0">
										Your film will be visible for {visibleDays} days, starting{' '}
										{formatDMY(effectiveStart)} to {formatDMY(endDate)}
									</Text>
								) : null}
							</>
						) : null}
					</div>
				</FieldGroup>

				<TextAlert>
					Uploading to Cinemata does not transfer ownership. <br />
					You keep full rights and control over how your film is shared.
				</TextAlert>

				{submitError || Object.keys(errors).length > 0 ? (
					<div
						role="alert"
						className="rounded-ds-4 border border-border-danger bg-bg-surface px-4 py-3 text-text-danger"
					>
						<Text variant="body-14-bold" as="p" className="m-0 text-text-danger">
							{submitError || 'Please fill in all required fields before sharing your media.'}
						</Text>
					</div>
				) : null}

				<div className="flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-end">
					<Button
						type="button"
						variant="secondary"
						title="Saving as draft will be wired in a later integration slice."
					>
						Save as Draft
					</Button>

					<Button type="button" onClick={handleShareClick} disabled={isSubmitting}>
						{isSubmitting ? 'Sharing…' : 'Share Media'}
					</Button>
				</div>
			</form>

			<Dialog open={shareStage === 'download'} onOpenChange={(open) => !open && setShareStage(null)}>
				<ConfirmationDialogContent
					title="Heads-up! This media can be downloaded."
					subtitle="Just to confirm that you consciously checked the Allow Download button."
					aria-label="Allow download confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => setShareStage(null)}>
								Cancel
							</Button>
							<Button variant="primary" onClick={postOrReview}>
								Yes, Proceed
							</Button>
						</>
					}
				/>
			</Dialog>

			<Dialog open={shareStage === 'review'} onOpenChange={(open) => !open && setShareStage(null)}>
				<ConfirmationDialogContent
					title="Submit For Review?"
					subtitle="As a regular user, your video needs to be reviewed by an admin before being published. You will get an email notification after the review."
					aria-label="Submit for review confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => setShareStage(null)}>
								Cancel
							</Button>
							<Button variant="primary" onClick={submitMedia}>
								Yes, Submit
							</Button>
						</>
					}
				/>
			</Dialog>
		</>
	);
}

export function SingleUploadPage({
	accept = 'video/*',
	canPublishDirectly = false,
	categories = [],
	contentSensitivities = [],
	csrfToken = '',
	hasUploadedMedia = false,
	maxFiles = 1,
	mediaCountries = [],
	mediaLanguages = [],
	onFilesSelected,
	showUploader = false,
	topics = [],
	uploadedMedia = null,
	uploader,
}) {
	return (
		<div className="single-upload-page">
			<Card className="py-8 px-6">
				<section
					className="add-media-upload-stage"
					data-upload-complete={hasUploadedMedia ? 'true' : 'false'}
					data-uploader-visible={showUploader ? 'true' : 'false'}
				>
					<Text variant="h5" as="h2" className="m-0 text-text-strong">
						Single Media Upload
					</Text>

					<div className="my-4 border-b border-b-border-divider" />

					{!showUploader ? (
						<MediaDropzone
							accept={accept}
							multiple={maxFiles !== 1}
							label="Drag & Drop File or"
							buttonVariant="secondary"
							buttonLabel="CHOOSE MEDIA"
							onFilesSelected={onFilesSelected}
						/>
					) : null}

					<div hidden={!showUploader}>{uploader}</div>
				</section>
			</Card>

			{hasUploadedMedia ? (
				<MediaDetailsForm
					canPublishDirectly={canPublishDirectly}
					categories={categories}
					contentSensitivities={contentSensitivities}
					csrfToken={csrfToken}
					editUrl={uploadedMedia?.editUrl ?? ''}
					mediaCountries={mediaCountries}
					mediaLanguages={mediaLanguages}
					topics={topics}
				/>
			) : null}
		</div>
	);
}
