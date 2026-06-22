import { useEffect, useState } from 'react';
import { ThumbnailUploadField } from '../../../shared/components/upload-media';
import { SpriteFrame } from '../../../shared/components/upload-media/ChooseFromVideo/SpriteFrame';
import { FieldGroup } from './FieldGroup';

export function ThumbnailImageUpload({
	currentThumbnailTime = '',
	duration = '',
	friendlyToken = '',
	onFileChanged,
	onFrameSelect,
	posterUrl = '',
	selectedThumbnailFile,
	spriteSecs = '',
	spritesUrl = '',
}) {
	const [previewUrl, setPreviewUrl] = useState('');
	const [selectedVideoFrame, setSelectedVideoFrame] = useState(null);

	useEffect(() => {
		if (!selectedThumbnailFile || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
			setPreviewUrl('');
			return undefined;
		}

		setSelectedVideoFrame(null);
		const nextPreviewUrl = URL.createObjectURL(selectedThumbnailFile);
		setPreviewUrl(nextPreviewUrl);

		return () => URL.revokeObjectURL(nextPreviewUrl);
	}, [selectedThumbnailFile]);

	function handleFrameSelect(seconds, frame) {
		setSelectedVideoFrame(frame);
		onFrameSelect?.(seconds, frame);
	}

	function handleFileSelected(file) {
		onFileChanged?.(file ? [file] : []);
	}

	const headerPreview = selectedVideoFrame?.spritesUrl ? (
		<SpriteFrame
			index={selectedVideoFrame.index}
			label={`Selected video frame at ${selectedVideoFrame.mmss}`}
			rowsInSheet={selectedVideoFrame.rowsInSheet}
			selected
			spritesUrl={selectedVideoFrame.spritesUrl}
			variant="preview"
		/>
	) : previewUrl ? (
		<img
			src={previewUrl}
			alt="Selected thumbnail header preview"
			className="aspect-video w-[150px] rounded-ds-4 object-cover"
		/>
	) : posterUrl ? (
		<img
			src={posterUrl}
			alt="Current thumbnail preview"
			className="aspect-video w-[150px] rounded-ds-4 object-cover"
		/>
	) : null;

	return (
		<FieldGroup
			title="Thumbnail Image Upload"
			description="This image displays when your video isn’t autoplaying. Use the auto-generated thumbnail, upload a custom image, or choose a still frame from your video."
			headerAside={headerPreview}
		>
			<ThumbnailUploadField
				currentThumbnailTime={currentThumbnailTime}
				duration={duration}
				friendlyToken={friendlyToken}
				onFileSelected={handleFileSelected}
				onFrameSelect={handleFrameSelect}
				posterFile={selectedThumbnailFile}
				posterPreviewClassName="mt-4 aspect-video w-full max-w-[280px] rounded-ds-4 object-cover md:hidden"
				posterUrl={posterUrl}
				spriteSecs={spriteSecs}
				spritesUrl={spritesUrl}
			/>
		</FieldGroup>
	);
}
