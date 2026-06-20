import { Icon, Button, TextAlert } from '../../../../shared/components';
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
	LicenseSelect,
	AllRightsReservedCheckbox,
	EnableCommentsCheckbox,
	AllowDownloadCheckbox,
	StatusRadioGroup,
	RestrictedPasswordField,
} from '../../../../shared/components/upload-media';
import { QuickPreview } from '../../../../upload-quick-preview';
import useBulkUploadStore from '../../useBulkUploadStore';
import { useBulkUploadConfig } from '../../bulkUploadConfig';
import { useBulkUploadActions } from '../../BulkUploadActionsContext';
import { formatFileSize } from '../../utils/formatSize';
import { ThumbnailStepSlot } from './ThumbnailStepSlot';

// Friendly labels for the per-file "please complete" summary, so an error on a
// field that lives on another sub-step is still named even when it's offscreen.
const FIELD_LABELS = {
	title: 'Title',
	summary: 'Synopsis',
	description: 'More Information',
	year_produced: 'Year Produced',
	year_produced_custom: 'Year Produced',
	company: 'Production Company',
	website: 'Website',
	media_language: 'Media Language',
	media_country: 'Media Country',
	category: 'Category',
	topics: 'Topic',
	content_sensitivity: 'Content Sensitivity',
	new_tags: 'Tags',
	custom_license: 'License',
	no_license: 'License',
	state: 'Status',
	password: 'Password',
	__all__: 'Form',
};

/**
 * One uploaded file's details: the metadata form (left) and a live Quick Preview
 * (#534) as a separate card beside it (right), matching the single-upload layout.
 * The active sub-step decides which field group the form shows; the preview stays
 * visible across every sub-step. Metadata is strictly per-file (decision D6).
 */
export function FileCard({ file, subStep, options, errors = {}, onClearErrors }) {
	const setMetadata = useBulkUploadStore((state) => state.setMetadata);
	const { deleteFile } = useBulkUploadActions();
	const { isTrustedUser } = useBulkUploadConfig();
	const meta = file.metadata;
	const patch = (next) => {
		setMetadata(file.id, next);
		// Clear the red error on any field the user just edited.
		onClearErrors?.(file.id, Object.keys(next));
	};

	const errorKeys = Object.keys(errors);
	const errorLabels = [...new Set(errorKeys.map((key) => FIELD_LABELS[key] || key))];

	// Resolve codes/ids to display labels for the preview card.
	const countryLabel = options.countries?.find((country) => country.code === meta.media_country)?.title || '';
	const firstCategoryId = Array.isArray(meta.category) ? meta.category[0] : undefined;
	const firstCategory = options.categories?.find((category) => category.id === firstCategoryId);
	const previewCategory = firstCategory ? { title: firstCategory.title } : null;

	return (
		<div className="grid grid-cols-1 items-start gap-6 @3xl/main:grid-cols-[minmax(0,1fr)_300px]">
			<article className="min-w-0 rounded-ds-8 bg-bg-surface p-5">
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

				{errorKeys.length > 0 ? (
					<TextAlert role="alert" className="mt-4 text-text-danger" iconName="infoYellow">
						Please complete: {errorLabels.join(', ')}.
					</TextAlert>
				) : null}

				<div className="mt-5 grid gap-5">
					{subStep === 'basic' ? (
						<>
							<TitleField
								value={meta.title}
								onChange={(value) => patch({ title: value })}
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
								customValue={meta.year_produced_custom}
								onChange={(next) => patch(next)}
								error={errors.year_produced || errors.year_produced_custom}
							/>
						</>
					) : null}

					{subStep === 'thumbnail' ? <ThumbnailStepSlot /> : null}

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
							<CategoryCheckboxGroup
								name={`category-${file.id}`}
								value={meta.category}
								onChange={(value) => patch({ category: value })}
								options={options.categories}
								error={errors.category}
							/>
							<TopicCheckboxGroup
								name={`topics-${file.id}`}
								value={meta.topics}
								onChange={(value) => patch({ topics: value })}
								options={options.topics}
							/>
							<ContentSensitivityGroup
								name={`sensitivity-${file.id}`}
								value={meta.content_sensitivity}
								onChange={(value) => patch({ content_sensitivity: value })}
								options={options.content_sensitivities}
							/>
							<TagsField value={meta.new_tags} onChange={(value) => patch({ new_tags: value })} />
							<LicenseSelect
								value={meta.custom_license}
								onChange={(value) => patch({ custom_license: value })}
								options={options.licenses}
								disabled={meta.no_license}
							/>
							<AllRightsReservedCheckbox
								checked={meta.no_license}
								onChange={(checked) =>
									patch({ no_license: checked, custom_license: checked ? '' : meta.custom_license })
								}
							/>
						</>
					) : null}

					{subStep === 'final' ? (
						<>
							<EnableCommentsCheckbox
								checked={meta.enable_comments}
								onChange={(checked) => patch({ enable_comments: checked })}
							/>
							<AllowDownloadCheckbox
								checked={meta.allow_download}
								onChange={(checked) => patch({ allow_download: checked })}
							/>
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
						</>
					) : null}
				</div>
			</article>

			<QuickPreview
				title={meta.title}
				thumbnailUrl={file.thumbnailUrl || ''}
				subtitle={meta.company}
				country={countryLabel}
				category={previewCategory}
				className="min-w-0 @3xl/main:sticky @3xl/main:top-[calc(var(--header-height)+1rem)]"
			/>
		</div>
	);
}
