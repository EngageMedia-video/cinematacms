import { useEffect, useState } from 'react';
import { TabContent, TabView } from '../../TabView';
import { MediaDropzone } from '../../MediaDropzone';
import { Text } from '../../Text';

/**
 * Per-file thumbnail picker, mirroring the single-upload ThumbnailImageUpload
 * (identical TabView styling, dropzone props and preview): an "Upload Thumbnail"
 * tab (choose a photo) and a "Choose from Video" placeholder (owned by #541).
 * Controlled by the chosen poster File so the bulk wizard can keep one per file;
 * the file is sent as `uploaded_poster` on submit (decision D4).
 */
export function ThumbnailUploadField({ posterFile = null, onFileSelected }) {
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

	return (
		<div>
			<TabView
				tabMode="wrap"
				triggerClassName="rounded-none py-3 px-size-22 text-text-tab-trigger"
				triggerSelectedColor="bg-bg-tab-trigger-selected"
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
						aria-label="Choose thumbnail image"
						onFilesSelected={(files) => onFileSelected?.(files?.[0] ?? null)}
					/>

					{previewUrl ? (
						<img
							src={previewUrl}
							alt="Selected thumbnail preview"
							className="mt-4 aspect-video w-full max-w-[280px] rounded-ds-4 object-cover"
						/>
					) : null}

					{posterFile?.name ? (
						<Text variant="body-14" className="m-0 mt-4 text-text-muted">
							Last selected: {posterFile.name}
						</Text>
					) : null}
				</TabContent>
				<TabContent title="CHOOSE FROM VIDEO" value="choose-from-video">
					<p>Choose from video</p>
				</TabContent>
			</TabView>
		</div>
	);
}
