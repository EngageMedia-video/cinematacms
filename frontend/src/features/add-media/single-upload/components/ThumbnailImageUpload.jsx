import { useEffect, useState } from 'react';
import { TabContent, TabView } from '../../../shared/components';
import { MediaDropzone } from '../../../shared/components/MediaDropzone';
import { Text } from '../../../shared/components/Text';
import { FieldGroup } from './FieldGroup';

export function ThumbnailImageUpload({ lastSelectedThumbnailFile, onFileChanged, selectedThumbnailFile }) {
	const [previewUrl, setPreviewUrl] = useState('');

	useEffect(() => {
		if (!selectedThumbnailFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
			setPreviewUrl('');
			return undefined;
		}

		const nextPreviewUrl = URL.createObjectURL(selectedThumbnailFile);
		setPreviewUrl(nextPreviewUrl);

		return () => URL.revokeObjectURL(nextPreviewUrl);
	}, [selectedThumbnailFile]);

	return (
		<FieldGroup
			title="Thumbnail Image Upload"
			description="This image will display when your video isn’t autoplaying. You can select an auto-generated image, upload a custom image or choose a still frame from your video."
		>
			<div>
				<TabView
					tabMode="wrap"
					triggerClassName="rounded-none py-3 px-size-22 text-neutral-50"
					triggerSelectedColor="cinemata-strait-blue-200"
					panelClassName="mt-8"
					aria-label="Upload media type"
					defaultSelectedTab="upload-thumbnail"
				>
					<TabContent title="UPLOAD THUMBNAIL" value="upload-thumbnail">
						<MediaDropzone
							accept="image/*"
							buttonVariant="secondary"
							iconName={null}
							multiple={false}
							name="uploaded_poster"
							aria-label="Choose thumbnail image"
							onFilesSelected={onFileChanged}
						/>

						{previewUrl ? (
							<img
								src={previewUrl}
								alt="Selected thumbnail preview"
								className="mt-4 aspect-video w-full max-w-[280px] rounded-ds-4 object-cover"
							/>
						) : null}

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
	);
}
