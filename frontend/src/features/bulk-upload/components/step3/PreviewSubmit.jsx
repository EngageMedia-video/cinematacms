import { Text, TextAlert } from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import { validateMetadata } from '../../../shared/components/upload-media';
import { QuickPreview } from '../../../upload-quick-preview';
import { formatFileSize } from '../../utils/formatSize';

const FIELD_LABELS = {
	title: 'Title',
	summary: 'Synopsis',
	description: 'More Information',
	year_produced: 'Year Produced',
	year_produced_custom: 'Year Produced',
	company: 'Production Company',
	category: 'Category',
	topics: 'Topic',
	content_sensitivity: 'Content Sensitivity',
	media_country: 'Media Country',
	media_language: 'Media Language',
	website: 'Website',
	new_tags: 'Tags',
	custom_license: 'License',
	no_license: 'License',
	enable_comments: 'Enable Comments',
	allow_download: 'Allow Download',
	state: 'Status',
	requirePassword: 'Require Password',
	password: 'Password',
	__all__: 'Form',
};

const STATUS_LABELS = {
	public: 'Public',
	private: 'Private',
	restricted: 'Restricted',
	unlisted: 'Unlisted',
};

function normalizeId(value) {
	return value === undefined || value === null ? '' : String(value);
}

function findOptionLabel(options = [], value, valueKey = 'id') {
	const normalizedValue = normalizeId(value);
	const option = options.find((item) => normalizeId(item[valueKey]) === normalizedValue);
	return option?.title || option?.label || '';
}

function joinOptionLabels(values = [], options = [], valueKey = 'id') {
	const labels = values.map((value) => findOptionLabel(options, value, valueKey)).filter(Boolean);
	return labels.length > 0 ? labels.join(', ') : 'Not selected';
}

function metadataStatus(metadata) {
	if (metadata.requirePassword) {
		return STATUS_LABELS.restricted;
	}
	return STATUS_LABELS[metadata.state] || metadata.state || 'Not selected';
}

function licenseLabel(metadata, licenses = []) {
	if (metadata.no_license) {
		return 'All Rights Reserved';
	}
	return findOptionLabel(licenses, metadata.custom_license) || 'Not selected';
}

function errorLabels(errors) {
	return [...new Set(Object.keys(errors).map((field) => FIELD_LABELS[field] || field))];
}

function SummaryRow({ label, value }) {
	return (
		<div>
			<dt className="body-body-12-medium m-0 text-text-muted">{label}</dt>
			<dd className="body-body-14-regular m-0 mt-1 text-text-strong">{value || 'Not provided'}</dd>
		</div>
	);
}

export function PreviewSubmit({ files = [], options = {}, validationErrors = {} }) {
	const readyCount = files.filter((file) => Object.keys(validateMetadata(file.metadata)).length === 0).length;

	return (
		<div>
			<div className="@3xl/main:pr-[324px]">
				<Text as="h1" variant="h5" className="text-text-strong">
					Preview & Submit
				</Text>
				<Text as="p" variant="body-14" className="mt-2 max-w-[680px] text-text-muted">
					Check each item for missing required details. Sharing saves the batch and starts the normal review
					path for regular users.
				</Text>

				<div className="mt-6 grid gap-4 rounded-ds-8 border border-border-default bg-bg-surface-muted p-4 sm:grid-cols-3">
					<div>
						<Text as="p" variant="body-12-medium" className="m-0 text-text-muted">
							Ready files
						</Text>
						<Text as="p" variant="h6" className="m-0 mt-1 text-text-strong">
							{readyCount} of {files.length}
						</Text>
					</div>
					<div>
						<Text as="p" variant="body-12-medium" className="m-0 text-text-muted">
							Action
						</Text>
						<Text as="p" variant="body-16-medium" className="m-0 mt-1 text-text-strong">
							Share media
						</Text>
					</div>
					<div>
						<Text as="p" variant="body-12-medium" className="m-0 text-text-muted">
							Review path
						</Text>
						<Text as="p" variant="body-16-medium" className="m-0 mt-1 text-text-strong">
							Admin review may apply
						</Text>
					</div>
				</div>

				{files.length === 0 ? (
					<TextAlert role="status" className="mt-6 text-text-warning" iconName="infoYellow">
						No completed uploads are ready to submit yet.
					</TextAlert>
				) : null}
			</div>

			<div className="mt-6 flex flex-col gap-4">
				{files.map((file) => {
					const meta = file.metadata || {};
					const errors = validationErrors[file.id] || validateMetadata(meta);
					const hasErrors = Object.keys(errors).length > 0;
					const labels = errorLabels(errors);
					const title = meta.title || file.name;
					const countryLabel = findOptionLabel(options.countries, meta.media_country, 'code');
					const firstCategoryId = Array.isArray(meta.category) ? meta.category[0] : undefined;
					const firstCategory = options.categories?.find(
						(category) => normalizeId(category.id) === normalizeId(firstCategoryId)
					);
					const previewCategory = firstCategory ? { title: firstCategory.title } : null;

					return (
						<div
							key={file.id}
							className="grid grid-cols-1 items-start gap-6 @3xl/main:grid-cols-[minmax(0,1fr)_300px]"
						>
							<article className="min-w-0 rounded-ds-8 border border-border-default bg-bg-surface p-5">
								<header className="flex flex-col gap-3 border-b border-border-divider pb-4 sm:flex-row sm:items-start sm:justify-between">
									<div className="min-w-0">
										<Text
											as="h2"
											variant="h6"
											className="m-0 truncate text-text-strong"
											title={title}
										>
											{title}
										</Text>
										<Text as="p" variant="body-12" className="m-0 mt-1 text-text-muted">
											{file.name}
											{file.sizeBytes ? ` - ${formatFileSize(file.sizeBytes)}` : ''}
										</Text>
									</div>
									<span
										className={cn(
											'body-body-12-medium inline-flex w-fit rounded-ds-4 px-3 py-1',
											hasErrors
												? 'bg-bg-surface-muted text-text-warning'
												: 'bg-bg-success-subtle text-text-success'
										)}
									>
										{hasErrors ? 'Needs attention' : 'Ready to submit'}
									</span>
								</header>

								{hasErrors ? (
									<TextAlert role="alert" className="mt-4 text-text-danger" iconName="infoYellow">
										Complete before sharing: {labels.join(', ')}.
									</TextAlert>
								) : null}

								<dl className="mt-5 grid gap-4 sm:grid-cols-2">
									<SummaryRow label="Synopsis" value={meta.summary} />
									<SummaryRow
										label="Year Produced"
										value={
											meta.year_produced === 'other'
												? meta.year_produced_custom
												: meta.year_produced
										}
									/>
									<SummaryRow
										label="Language"
										value={findOptionLabel(options.languages, meta.media_language, 'code')}
									/>
									<SummaryRow
										label="Country"
										value={findOptionLabel(options.countries, meta.media_country, 'code')}
									/>
									<SummaryRow
										label="Category"
										value={joinOptionLabels(meta.category, options.categories)}
									/>
									<SummaryRow label="Topic" value={joinOptionLabels(meta.topics, options.topics)} />
									<SummaryRow
										label="Content Sensitivity"
										value={joinOptionLabels(
											meta.content_sensitivity,
											options.content_sensitivities
										)}
									/>
									<SummaryRow label="Status" value={metadataStatus(meta)} />
									<SummaryRow label="License" value={licenseLabel(meta, options.licenses)} />
									<SummaryRow label="Tags" value={meta.new_tags} />
								</dl>
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
				})}
			</div>
		</div>
	);
}
