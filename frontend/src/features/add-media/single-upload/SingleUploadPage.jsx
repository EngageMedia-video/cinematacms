import { useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTaxonomies } from '../../shared/components/upload-media';
import { Card } from '../../shared/components';
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

function SingleUploadContent({
	accept = 'video/*',
	canPublishDirectly = false,
	canUseAdminSettings = false,
	csrfToken = '',
	hasUploadedMedia = false,
	maxFiles = 1,
	onFilesSelected,
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
					canUseAdminSettings={canUseAdminSettings}
					categories={categories}
					contentSensitivities={contentSensitivities}
					csrfToken={csrfToken}
					editUrl={uploadedMedia?.editUrl ?? ''}
					licenses={licenses}
					mediaCountries={mediaCountries}
					mediaLanguages={mediaLanguages}
					topics={topics}
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
