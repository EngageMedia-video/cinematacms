import React from 'react';
import ReactDOM from 'react-dom';
import { _VideoMediaPage } from './_VideoMediaPage';
import VideoViewer from '../../components/MediaViewer/VideoViewer';
import { SiteConsumer } from '../../contexts/SiteContext';

export class MediaPageVideo extends _VideoMediaPage {
	viewerContainerContent(mediaData) {
		return (
			<SiteConsumer>{(site) => <VideoViewer data={mediaData} siteUrl={site.url} inEmbed={!1} />}</SiteConsumer>
		);
	}

	mediaType() {
		return 'video';
	}
}
