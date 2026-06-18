import { QueryClientProvider } from '@tanstack/react-query';
import { Card } from '../../shared/components';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { Text } from '../../shared/components/Text';
import { MediaDetailsForm } from './components/MediaDetailsForm';
import singleUploadQueryClient from './queryClient';

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
		<QueryClientProvider client={singleUploadQueryClient}>
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
		</QueryClientProvider>
	);
}
