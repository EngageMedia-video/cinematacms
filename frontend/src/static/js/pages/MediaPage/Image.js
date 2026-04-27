import React from 'react';
import ReactDOM from 'react-dom';
import { _MediaPage } from './_MediaPage';
import ImageViewer from '../../components/MediaViewer/ImageViewer';

export class MediaPageImage extends _MediaPage {
	viewerContainerContent() {
		return <ImageViewer />;
	}

	mediaType() {
		return 'image';
	}
}
