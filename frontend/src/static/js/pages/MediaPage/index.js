import React from 'react';
import ReactDOM from 'react-dom';

import VideoViewer from '../../components/MediaViewer/VideoViewer';
import AudioViewer from '../../components/MediaViewer/AudioViewer';

import { SiteConsumer } from '../../contexts/SiteContext';

import ImageViewer from '../../components/MediaViewer/ImageViewer';
import PdfViewer from '../../components/MediaViewer/PdfViewer';
import AttachmentViewer from '../../components/MediaViewer/AttachmentViewer';

import { _VideoMediaPage } from './_VideoMediaPage';

import MediaPageStore from './store.js';

export class MediaPage extends _VideoMediaPage {
	viewerContainerContent(mediaData) {
		switch (MediaPageStore.get('media-type')) {
			case 'video':
				return (
					<SiteConsumer>
						{(site) => <VideoViewer data={mediaData} siteUrl={site.url} inEmbed={!1} />}
					</SiteConsumer>
				);
			case 'audio':
				return <AudioViewer />;
			case 'image':
				return <ImageViewer />;
			case 'pdf':
				return <PdfViewer />;
		}

		return <AttachmentViewer />;
	}
}
