import { Card, MediaDropzone, TextAlert, Text } from '../../../../shared/components';
import { EditorialPolicyNotice } from '../../../../shared/components/upload-media';
import { cn } from '../../../../shared/utils/classNames';
import { useBulkUploadConfig } from '../../bulkUploadConfig';
import { useBulkUploadActions } from '../../BulkUploadActionsContext';
import useBulkUploadStore from '../../useBulkUploadStore';
import { UploadedFilesList } from './UploadedFilesList';

export function Step1UploadMedia({ files }) {
	const { isTrustedUser, maxFiles, embedded } = useBulkUploadConfig();
	const { addFiles } = useBulkUploadActions();
	const lastError = useBulkUploadStore((state) => state.lastError);

	return (
		<div>
			{/* Standalone page header. As the add-media tab (embedded) the host page
			    already renders the title, editorial-policy notice and tab switcher. */}
			{!embedded ? (
				<>
					<div className="flex items-start justify-between gap-4">
						<Text as="h1" variant="h5" className="text-text-strong">
							Bulk Upload Media to Cinemata
						</Text>
						<span className="body-body-12-regular shrink-0 text-text-accent">* Required</span>
					</div>
					<EditorialPolicyNotice className="mt-2" />
				</>
			) : null}

			<Card as="section" className={cn('add-media-upload-stage py-8 px-6', !embedded && 'mt-6')}>
				<Text as="h2" variant="h5" id="bulk-media-upload-title" className="m-0 text-text-strong">
					Bulk Media Upload
				</Text>
				<div className="my-4 border-b border-b-border-divider" />
				<MediaDropzone
					multiple
					accept="video/*"
					buttonVariant="secondary"
					label="Drag & Drop File(s) or"
					buttonLabel="CHOOSE MEDIA"
					onFilesSelected={addFiles}
				/>

				<Text as="p" variant="body-14" className="m-0 mt-4 text-text-muted">
					{isTrustedUser ? (
						<>You can upload up to {maxFiles} files.</>
					) : (
						<>
							You can upload <span className="text-text-accent">{maxFiles} files max</span> as a Regular
							User. Only Trusted Users can upload up to 10 files,{' '}
							<a
								href="/contact"
								className="font-semibold text-text-link underline hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
							>
								Contact Us
							</a>{' '}
							to request Trusted User access.
						</>
					)}
				</Text>
			</Card>

			{lastError ? (
				<TextAlert className="mt-3 text-text-danger" role="alert" iconName="infoYellow">
					{lastError}
				</TextAlert>
			) : null}

			<UploadedFilesList files={files} maxFiles={maxFiles} />

			<TextAlert className="mt-8" iconName="infoCircle">
				Uploading to Cinemata does not transfer ownership. You keep full rights and control over how your film
				is shared.
			</TextAlert>
		</div>
	);
}
