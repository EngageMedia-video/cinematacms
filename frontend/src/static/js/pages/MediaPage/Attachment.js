import React from 'react';
import ReactDOM from 'react-dom';
import { _MediaPage } from './_MediaPage';
import AttachmentViewer from '../../components/MediaViewer/AttachmentViewer';

export class MediaPageAttachment extends _MediaPage {
	viewerContainerContent() {
		return <AttachmentViewer />;
	}
}
