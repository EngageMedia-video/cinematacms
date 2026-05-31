import React from 'react';

import { Page } from '../../../static/js/pages/_Page';
import PageStore from '../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../static/js/pages/MediaPage/actions.js';
import ViewerInfoVideo from './ViewerInfoVideo';
import ViewerError from '../../../static/js/pages/MediaPage/includes/ViewerError';
import ViewerSidebar from './ViewerSidebar';
import VideoViewer from '../../../static/js/components/MediaViewer/VideoViewer';
import VideoViewerStore from '../../../static/js/components/MediaViewer/VideoViewer/store.js';
import { SiteConsumer } from '../../../static/js/contexts/SiteContext';
import { RestrictedMediaGate } from '../../shared/components/RestrictedMediaGate';
import { CommentsSection } from '../../comments';

import '../../../static/js/pages/styles/MediaPage.scss';

const wideLayoutBreakpoint = 1216;

export class VideoViewerPage extends Page {
	constructor(props) {
		super(props, 'media');

		this.state = {
			wideLayout: wideLayoutBreakpoint <= PageStore.get('window-inner-width'),
			mediaLoaded: false,
			mediaLoadFailed: false,
			isVideoMedia: false,
			theaterMode: false,
			pagePlaylistLoaded: false,
			pagePlaylistData: MediaPageStore.get('playlist-data'),
			needsPassword: false,
		};

		this.onWindowResize = this.onWindowResize.bind(this);
		this.onMediaLoad = this.onMediaLoad.bind(this);
		this.onMediaLoadError = this.onMediaLoadError.bind(this);
		this.onPagePlaylistLoad = this.onPagePlaylistLoad.bind(this);
		this.onNeedsPassword = this.onNeedsPassword.bind(this);
		this.onPasswordSuccess = this.onPasswordSuccess.bind(this);

		MediaPageStore.on('loaded_media_data', this.onMediaLoad);
		MediaPageStore.on('loaded_media_error', this.onMediaLoadError);
		MediaPageStore.on('loaded_page_playlist_data', this.onPagePlaylistLoad);
		MediaPageStore.on('media_needs_password', this.onNeedsPassword);
	}

	componentDidMount() {
		MediaPageActions.loadMediaData();
		PageStore.on('window_resize', this.onWindowResize);
	}

	componentWillUnmount() {
		MediaPageStore.removeListener('loaded_media_data', this.onMediaLoad);
		MediaPageStore.removeListener('loaded_media_error', this.onMediaLoadError);
		MediaPageStore.removeListener('loaded_page_playlist_data', this.onPagePlaylistLoad);
		MediaPageStore.removeListener('media_needs_password', this.onNeedsPassword);
		PageStore.removeListener('window_resize', this.onWindowResize);
		if (this.onViewerModeChange) {
			VideoViewerStore.removeListener('changed_viewer_mode', this.onViewerModeChange);
		}
	}

	onWindowResize() {
		this.setState({
			wideLayout: wideLayoutBreakpoint <= PageStore.get('window-inner-width'),
		});
	}

	onPagePlaylistLoad() {
		this.setState({
			pagePlaylistLoaded: true,
			pagePlaylistData: MediaPageStore.get('playlist-data'),
		});
	}

	onMediaLoad() {
		const isVideoMedia = 'video' === MediaPageStore.get('media-type');

		if (isVideoMedia) {
			this.onViewerModeChange = this.onViewerModeChange.bind(this);

			VideoViewerStore.on('changed_viewer_mode', this.onViewerModeChange);

			this.setState({
				mediaLoaded: true,
				isVideoMedia: isVideoMedia,
				theaterMode: VideoViewerStore.get('in-theater-mode'),
			});
		} else {
			this.setState({
				mediaLoaded: true,
				isVideoMedia: isVideoMedia,
			});
		}
	}

	onViewerModeChange() {
		this.setState({ theaterMode: VideoViewerStore.get('in-theater-mode') });
	}

	onMediaLoadError() {
		this.setState({ mediaLoadFailed: true });
	}

	onNeedsPassword() {
		this.setState({ needsPassword: true });
	}

	onPasswordSuccess(token) {
		MediaCMS.access_token = token;
		MediaCMS.media_restricted = false;
		this.setState({ needsPassword: false });
		MediaPageActions.loadMediaData();
	}

	viewerContainerContent(mediaData) {
		return (
			<SiteConsumer>{(site) => <VideoViewer data={mediaData} siteUrl={site.url} inEmbed={!1} />}</SiteConsumer>
		);
	}

	mediaType() {
		return 'video';
	}

	pageContent() {
		const viewerClassname = 'cf viewer-section' + (this.state.theaterMode ? ' theater-mode' : ' viewer-wide');
		const viewerNestedClassname = 'viewer-section-nested' + (this.state.theaterMode ? ' viewer-section' : '');
		const commentsPanel = this.state.mediaLoaded ? (
			<div className="viewer-sidebar-comments mb-6 box-border w-full px-4 md:px-0" key="viewer-comments">
				<CommentsSection friendlyToken={MediaPageStore.get('media-id')} variant="sidebar" />
			</div>
		) : null;

		if (this.state.needsPassword) {
			return <RestrictedMediaGate viewerClassname={viewerClassname} onPasswordSuccess={this.onPasswordSuccess} />;
		}

		return this.state.mediaLoadFailed ? (
			<div className={viewerClassname}>
				<ViewerError />
			</div>
		) : (
			<div className={viewerClassname}>
				{[
					<div className="viewer-container" key="viewer-container">
						{this.state.mediaLoaded && this.state.pagePlaylistLoaded
							? this.viewerContainerContent(MediaPageStore.get('media-data'))
							: null}
					</div>,
					<div key="viewer-section-nested" className={viewerNestedClassname}>
						{!this.state.wideLayout || (this.state.isVideoMedia && this.state.theaterMode)
							? [
									<ViewerInfoVideo key="viewer-info" />,
									<div className="viewer-sidebar" key="viewer-sidebar-panel">
										{commentsPanel}
										{this.state.pagePlaylistLoaded ? (
											<ViewerSidebar
												key="viewer-sidebar"
												mediaId={MediaPageStore.get('media-id')}
												playlistData={MediaPageStore.get('playlist-data')}
											/>
										) : null}
									</div>,
								]
							: [
									<div className="viewer-sidebar" key="viewer-sidebar-panel">
										{commentsPanel}
										{this.state.pagePlaylistLoaded ? (
											<ViewerSidebar
												key="viewer-sidebar"
												mediaId={MediaPageStore.get('media-id')}
												playlistData={MediaPageStore.get('playlist-data')}
											/>
										) : null}
									</div>,
									<ViewerInfoVideo key="viewer-info" />,
								]}
					</div>,
				]}
			</div>
		);
	}
}
