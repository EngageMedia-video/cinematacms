import { useCallback, useEffect, useMemo, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTaxonomies } from '../../shared/components/UploadMedia';
import { Card, Icon } from '../../shared/components';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { Text } from '../../shared/components/Text';
import { MediaDetailsForm } from './components/MediaDetailsForm';
import singleUploadQueryClient from './queryClient';
import { AlertOwnershipMedia } from './components/AlertOwnershipMedia';
import { EMPTY_PREVIEW, findLabel, toCodeOptions, toIdOptions } from '../utils/helpers';

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
	onSubmitSuccess,
	showUploader = false,
	uploadedMedia = null,
	uploader,
}) {
	const { options } = useTaxonomies();

	// Form Options
	const mediaLanguages = useMemo(() => toCodeOptions(options.languages), [options.languages]);
	const mediaCountries = useMemo(() => toCodeOptions(options.countries), [options.countries]);
	const categories = useMemo(() => toIdOptions(options.categories), [options.categories]);
	const topics = useMemo(() => toIdOptions(options.topics), [options.topics]);
	const contentSensitivities = useMemo(
		() => toIdOptions(options.content_sensitivities),
		[options.content_sensitivities]
	);
	const licenses = options.licenses;

	// Preview
	const [preview, setPreview] = useState(EMPTY_PREVIEW);
	const countryLabel = findLabel(mediaCountries, preview.media_country);
	const categoryLabel = findLabel(categories, preview.category);
	const handleFormPreviewChange = useCallback((partial) => setPreview((prev) => ({ ...prev, ...partial })), []);

	useEffect(() => {
		const next = {
			title: preview.title,
			company: preview.company,
			country: countryLabel,
			category: categoryLabel ? { title: categoryLabel } : null,
		};

		if (preview.thumbnailUrl) {
			next.thumbnailUrl = preview.thumbnailUrl;
		}
		if (Object.prototype.hasOwnProperty.call(preview, 'thumbnailUrl') && preview.thumbnailUrl === '') {
			next.thumbnailUrl = '';
		}
		if (Object.prototype.hasOwnProperty.call(preview, 'thumbnailFrame')) {
			next.thumbnailFrame = preview.thumbnailFrame;
		}
		onPreviewChange?.(next);
	}, [
		onPreviewChange,
		preview.title,
		preview.company,
		countryLabel,
		categoryLabel,
		preview.thumbnailUrl,
		preview.thumbnailFrame,
	]);

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

			{!showUploader && <AlertOwnershipMedia className="mt-8" />}

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
					uploadedMedia={uploadedMedia}
					onPreviewChange={handleFormPreviewChange}
					onSubmitSuccess={onSubmitSuccess}
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
