import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTaxonomies } from '../../shared/components/upload-media';
import { Card, Icon } from '../../shared/components';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { Text } from '../../shared/components/Text';
import { MediaDetailsForm } from './components/MediaDetailsForm';
import singleUploadQueryClient from './queryClient';

// Language/country use codes; the M2M taxonomies use ids. Mirrors the bulk-upload
// field mapping so both flows submit exactly what MediaForm expects.
function toCodeOptions(items = []) {
	return items.map((item) => ({ value: item.code, label: item.title }));
}

function toIdOptions(items = []) {
	return items.map((item) => ({ value: item.id, label: item.title }));
}

const EMPTY_PREVIEW = { title: '', company: '', media_country: '', category: '' };

function findLabel(options = [], value) {
	const option = options.find((item) => String(item.value ?? item.code) === String(value));
	return option?.label || option?.title || '';
}

function SingleUploadContent({
	accept = 'video/*',
	canPublishDirectly = false,
	canUseAdminSettings = false,
	csrfToken = '',
	externalMedia = null,
	hasUploadedMedia = false,
	maxFiles = 1,
	onFilesSelected,
	onPreviewChange,
	showUploader = false,
	uploadedMedia = null,
	uploader,
}) {
	const { options } = useTaxonomies();

	const mediaLanguages = useMemo(() => toCodeOptions(options.languages), [options.languages]);
	const mediaCountries = useMemo(() => toCodeOptions(options.countries), [options.countries]);
	const categories = useMemo(() => toIdOptions(options.categories), [options.categories]);
	const topics = useMemo(() => toIdOptions(options.topics), [options.topics]);
	const contentSensitivities = useMemo(
		() => toIdOptions(options.content_sensitivities),
		[options.content_sensitivities]
	);
	const licenses = options.licenses;

	// Raw values reported by the (uncontrolled) form, resolved to display labels
	// and pushed up so the host can render the Quick Preview in its shared slot.
	const [preview, setPreview] = useState(EMPTY_PREVIEW);
	const countryLabel = findLabel(mediaCountries, preview.media_country);
	const categoryLabel = findLabel(categories, preview.category);

	// Stable so the form's thumbnail effect (which creates/revokes an object URL on
	// change) doesn't re-run every render and revoke the preview blob early.
	const handleFormPreviewChange = useCallback((partial) => setPreview((prev) => ({ ...prev, ...partial })), []);

	useEffect(() => {
		const next = {
			title: preview.title,
			company: preview.company,
			country: countryLabel,
			category: categoryLabel ? { title: categoryLabel } : null,
		};
		// Only forward a chosen-thumbnail preview when one exists, so it doesn't wipe
		// the uploaded media's auto thumbnail that the host fetched on upload.
		if (preview.thumbnailUrl) {
			next.thumbnailUrl = preview.thumbnailUrl;
		}
		onPreviewChange?.(next);
	}, [onPreviewChange, preview.title, preview.company, countryLabel, categoryLabel, preview.thumbnailUrl]);

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

					{externalMedia ? (
						/* A file moved here from the bulk tab — already uploaded, so show a
						   "ready" row instead of the dropzone/uploader (no re-upload). */
						<div className="flex items-center gap-3 rounded-ds-4 bg-bg-surface-muted px-4 py-3">
							<Icon name="check" size={20} decorative className="text-text-success" />
							<span className="body-body-14-medium text-text-strong">
								{externalMedia.name || 'Uploaded media'}
							</span>
							<span className="body-body-12-regular text-text-success">Ready</span>
						</div>
					) : (
						<>
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
						</>
					)}
				</section>
			</Card>

			{hasUploadedMedia ? (
				<MediaDetailsForm
					canPublishDirectly={canPublishDirectly}
					canUseAdminSettings={canUseAdminSettings}
					categories={categories}
					contentSensitivities={contentSensitivities}
					csrfToken={csrfToken}
					editUrl={uploadedMedia?.editUrl ?? ''}
					licenses={licenses}
					mediaCountries={mediaCountries}
					mediaLanguages={mediaLanguages}
					topics={topics}
					onPreviewChange={handleFormPreviewChange}
				/>
			) : null}
		</div>
	);
}

export function SingleUploadPage(props) {
	return (
		<QueryClientProvider client={singleUploadQueryClient}>
			<SingleUploadContent {...props} />
		</QueryClientProvider>
	);
}
