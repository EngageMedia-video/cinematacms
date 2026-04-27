import React from 'react';
import ReactDOM from 'react-dom';
import { _MediaPage } from './_MediaPage';
import AudioViewer from '../../components/MediaViewer/AudioViewer';

export class MediaPageAudio extends _MediaPage {
	viewerContainerContent() {
		return <AudioViewer />;
	}

	mediaType() {
		return 'audio';
	}
}
