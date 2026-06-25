import { Card, Icon, Button, Text } from '../../../../shared/components';
import {
	TitleField,
	SynopsisField,
	MoreInfoField,
	YearProducedField,
	CompanyField,
	WebsiteField,
	MediaLanguageSelect,
	MediaCountrySelect,
	CategoryCheckboxGroup,
	TopicCheckboxGroup,
	ContentSensitivityGroup,
	TagsField,
	LicenseChooser,
	EnableCommentsCheckbox,
	AllowDownloadCheckbox,
	StatusRadioGroup,
	RestrictedPasswordField,
	VisibilityExpirationField,
	StreamProtectionField,
	AdminSettingsFields,
	ThumbnailUploadField,
} from '../../../../shared/components/upload-media';
import { FileQuickPreview } from '../FileQuickPreview';
import useBulkUploadStore from '../../useBulkUploadStore';
import { useBulkUploadConfig } from '../../bulkUploadConfig';
import { useBulkUploadActions } from '../../BulkUploadActionsContext';
import { formatFileSize } from '../../utils/formatSize';
import { required } from '../../../../shared/utils/validators';

function Divider() {
	return <div className="my-4 border-b border-b-border-divider" />;
}

// Section title/description per sub-step, mirroring the single-upload FieldGroup
// headings so each bulk card reads the same as the single-upload form sections.
const SECTION_META = {
	basic: {
		title: 'Basic Details',
		description: 'What viewers and curators will see when they find your film on Cinemata.',
	},
	thumbnail: {
		title: 'Thumbnail Image Upload',
		description:
			'This image displays when your video isn’t autoplaying. Use the auto-generated thumbnail, upload a custom image, or choose a still frame from your video.',
	},
	other: { title: 'Other Details' },
	final: { title: 'Final Settings' },
	admin: { title: 'Admin Settings' },
};

/**
 * One uploaded file's details: the metadata form (left) and a live Quick Preview
 * (#534) as a separate card beside it (right), matching the single-upload layout.
 * Each sub-step renders the same fields/widgets the single-upload form uses, kept
 * strictly per-file (decision D6). The preview stays visible across sub-steps.
 */
export function FileCard({ file, subStep, options, errors = {}, onClearErrors }) {
	const setMetadata = useBulkUploadStore((state) => state.setMetadata);
	const setPosterFile = useBulkUploadStore((state) => state.setPosterFile);
	const setThumbnailTime = useBulkUploadStore((state) => state.setThumbnailTime);
	const { deleteFile } = useBulkUploadActions();
	const { isTrustedUser, canUseAdminSettings } = useBulkUploadConfig();
	const meta = file.metadata;
	const patch = (next) => {
		setMetadata(file.id, next);
		// Clear the red error on any field the user just edited.
		onClearErrors?.(file.id, Object.keys(next));
	};

	return (
		<div className="grid grid-cols-1 items-start gap-8 @3xl/main:grid-cols-[minmax(0,1fr)_340px]">
			<Card as="article" className="min-w-0 py-8 px-6">
				<header className="flex items-start justify-between gap-4 border-b border-border-divider pb-4">
					<div className="flex min-w-0 items-center gap-3">
						<span
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-4 bg-bg-surface-muted text-text-muted"
							aria-hidden="true"
						>
							<Icon name="filmReel" size={20} decorative />
						</span>
						<div className="min-w-0">
							<p className="body-body-14-medium m-0 truncate text-text-strong" title={file.name}>
								{file.name}
							</p>
							{file.sizeBytes ? (
								<p className="body-body-12-regular m-0 text-text-muted">
									{formatFileSize(file.sizeBytes)}
								</p>
							) : null}
						</div>
					</div>
					<Button
						variant="text"
						size="sm"
						className="text-text-danger hover:text-text-danger"
						onClick={() => deleteFile(file.id)}
					>
						Delete
					</Button>
				</header>

				<div className="mt-6">
					<Text variant="h6-medium" as="h3" className="m-0 text-text-strong">
						{SECTION_META[subStep]?.title}
					</Text>
					{SECTION_META[subStep]?.description ? (
						<Text variant="body-14" color="meta" className="m-0 mt-2">
							{SECTION_META[subStep].description}
						</Text>
					) : null}
					<div className="my-6 border-b border-b-border-divider" />
				</div>

				<div className="grid gap-5">
					{subStep === 'basic' ? (
						<>
							<TitleField
								value={meta.title}
								onChange={(value) => patch({ title: value })}
								validate={[required()]}
								error={errors.title}
							/>
							<SynopsisField
								value={meta.summary}
								onChange={(value) => patch({ summary: value })}
								error={errors.summary}
							/>
							<MoreInfoField
								value={meta.description}
								onChange={(value) => patch({ description: value })}
							/>
							<YearProducedField
								value={meta.year_produced}
								onChange={(value) => patch({ year_produced: value })}
								error={errors.year_produced}
							/>
						</>
					) : null}
					{subStep === 'thumbnail' ? (
						<ThumbnailUploadField
							friendlyToken={file.friendlyToken ?? ''}
							onFrameSelect={(seconds, frame) => setThumbnailTime(file.id, seconds, frame)}
							posterFile={file.posterFile}
							posterUrl={file.thumbnailUrl ?? ''}
							onFileSelected={(posterFile) => setPosterFile(file.id, posterFile)}
							thumbnailFrame={file.thumbnailFrame}
							thumbnailTime={file.thumbnailTime}
						/>
					) : null}
					{subStep === 'other' ? (
						<>
							<CompanyField value={meta.company} onChange={(value) => patch({ company: value })} />
							<WebsiteField
								value={meta.website}
								onChange={(value) => patch({ website: value })}
								error={errors.website}
							/>
							<MediaLanguageSelect
								value={meta.media_language}
								onChange={(value) => patch({ media_language: value })}
								options={options.languages}
								error={errors.media_language}
							/>
							<MediaCountrySelect
								value={meta.media_country}
								onChange={(value) => patch({ media_country: value })}
								options={options.countries}
								error={errors.media_country}
							/>
							<div className="mt-3 flex flex-col gap-4 sm:flex-row">
								<CategoryCheckboxGroup
									name={`category-${file.id}`}
									value={meta.category}
									onChange={(value) => patch({ category: value })}
									options={options.categories}
									error={errors.category}
								/>
								<ContentSensitivityGroup
									name={`sensitivity-${file.id}`}
									value={meta.content_sensitivity}
									onChange={(value) => patch({ content_sensitivity: value })}
									options={options.content_sensitivities}
								/>
							</div>
							<div className="mt-3 flex flex-col gap-4 sm:flex-row">
								<TopicCheckboxGroup
									name={`topics-${file.id}`}
									value={meta.topics}
									onChange={(value) => patch({ topics: value })}
									options={options.topics}
									error={errors.topics}
								/>
							</div>
							<TagsField value={meta.new_tags} onChange={(value) => patch({ new_tags: value })} />
							<LicenseChooser
								name={`license-${file.id}`}
								value={meta.custom_license}
								noLicense={meta.no_license}
								options={options.licenses}
								onChange={(next) => patch(next)}
							/>
						</>
					) : null}
					{subStep === 'final' ? (
						<div className="flex flex-col">
							<EnableCommentsCheckbox
								checked={meta.enable_comments}
								onChange={(checked) => patch({ enable_comments: checked })}
							/>
							<AllowDownloadCheckbox
								checked={meta.allow_download}
								onChange={(checked) => patch({ allow_download: checked })}
							/>

							<Divider />

							<StatusRadioGroup
								name={`status-${file.id}`}
								value={meta.state}
								includeRestricted={isTrustedUser}
								onChange={(value) =>
									patch({ state: value, password: value === 'restricted' ? meta.password : '' })
								}
							/>
							{isTrustedUser && meta.state === 'restricted' ? (
								<RestrictedPasswordField
									id={`password-${file.id}`}
									password={meta.password}
									onPasswordChange={(value) => patch({ password: value })}
									error={errors.password}
								/>
							) : null}

							<Divider />

							<VisibilityExpirationField
								idPrefix={`visibility-${file.id}`}
								expireEnabled={meta.expireEnabled}
								startDate={meta.startDate}
								endDate={meta.endDate}
								onToggle={(checked) =>
									patch(
										checked
											? { expireEnabled: true }
											: { expireEnabled: false, startDate: '', endDate: '' }
									)
								}
								onStartDateChange={(value) => patch({ startDate: value })}
								onEndDateChange={(value) => patch({ endDate: value })}
							/>

							<Divider />

							<StreamProtectionField
								checked={meta.is_encrypted}
								onChange={(checked) => patch({ is_encrypted: checked })}
							/>
						</div>
					) : null}
					{subStep === 'admin' && canUseAdminSettings ? (
						<AdminSettingsFields
							featured={meta.featured}
							reportedTimes={meta.reported_times}
							onChange={(next) => patch(next)}
							idPrefix={`file-${file.id}`}
						/>
					) : null}
				</div>
			</Card>

			<FileQuickPreview
				file={file}
				options={options}
				className="min-w-0 @3xl/main:sticky @3xl/main:top-[calc(var(--header-height)+1rem)]"
			/>
		</div>
	);
}
