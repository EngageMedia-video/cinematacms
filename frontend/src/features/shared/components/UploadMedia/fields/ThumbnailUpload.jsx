import { useEffect, useState } from 'react';
import { TabContent, TabView } from '../../TabView';
import { MediaDropzone } from '../../MediaDropzone';
import { Text } from '../../Text';
import { ChooseFromVideo } from '../ChooseFromVideo/ChooseFromVideo';

/**
 * Per-file thumbnail picker, mirroring the single-upload ThumbnailImageUpload
 * tab contract: upload a photo or choose a frame from the uploaded video.
 */
export function ThumbnailUploadField({
	currentThumbnailTime = '',
	duration = '',
	friendlyToken = '',
	onFileSelected,
	onFrameSelect,
	posterFile = null,
	posterPreviewClassName = 'mt-4 aspect-video w-full max-w-[280px] rounded-ds-4 object-cover',
	posterUrl = '',
	spriteSecs = '',
	spritesUrl = '',
	thumbnailFrame = null,
	thumbnailTime = null,
}) {
	const [previewUrl, setPreviewUrl] = useState('');

	useEffect(() => {
		if (!posterFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
			setPreviewUrl('');
			return undefined;
		}

		const nextPreviewUrl = URL.createObjectURL(posterFile);
		setPreviewUrl(nextPreviewUrl);

		return () => URL.revokeObjectURL(nextPreviewUrl);
	}, [posterFile]);

	function handleFrameSelect(frame) {
		onFrameSelect?.(frame.seconds, frame);
	}

	return (
		<div className="min-w-0 max-w-full overflow-hidden">
			<TabView
				className="min-w-0 max-w-full overflow-hidden"
				tabMode="wrap"
				triggerClassName="rounded-none py-3 px-size-22 text-text-tab-trigger"
				triggerSelectedColor="bg-bg-tab-trigger-selected"
				panelClassName="mt-4 min-w-0 max-w-full overflow-hidden"
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
						onFilesSelected={(files) => onFileSelected?.(files?.[0] ?? null)}
					/>

					{previewUrl ? (
						<img src={previewUrl} alt="Selected thumbnail preview" className={posterPreviewClassName} />
					) : null}

					{posterFile?.name ? (
						<Text variant="body-14" className="m-0 mt-4 text-text-muted">
							Last selected: {posterFile.name}
						</Text>
					) : null}
				</TabContent>
				<TabContent title="CHOOSE FROM VIDEO" value="choose-from-video">
					<ChooseFromVideo
						currentThumbnailTime={thumbnailTime ?? currentThumbnailTime}
						duration={duration}
						friendlyToken={friendlyToken}
						onFrameSelect={handleFrameSelect}
						posterUrl={posterUrl}
						spriteSecs={spriteSecs}
						spritesUrl={spritesUrl || thumbnailFrame?.spritesUrl || ''}
					/>
				</TabContent>
			</TabView>
		</div>
	);
}
