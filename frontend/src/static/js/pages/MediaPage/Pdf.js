import React from 'react';
import ReactDOM from 'react-dom';
import { _MediaPage } from './_MediaPage';
import PdfViewer from '../../components/MediaViewer/PdfViewer';

export class MediaPagePdf extends _MediaPage {
	viewerContainerContent() {
		return <PdfViewer />;
	}
}
