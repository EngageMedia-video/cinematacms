import React from 'react';

import { Page } from '../../../../static/js/pages/_Page';
import PageStore from '../../../../static/js/pages/_PageStore';

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';
import ViewerInfoVideo from '../info/ViewerInfoVideo';
import ViewerError from '../../../../static/js/pages/MediaPage/includes/ViewerError';
import ViewerSidebar from '../sidebar/ViewerSidebar';
import VideoViewer from '../../../../static/js/components/MediaViewer/VideoViewer';
import VideoViewerStore from '../../../../static/js/components/MediaViewer/VideoViewer/store.js';
import { SiteConsumer } from '../../../../static/js/contexts/SiteContext';
import { RestrictedMediaGate } from '../../../shared/components/RestrictedMediaGate';
import { TabContent, TabView } from '../../../shared/components/TabView/TabView.jsx';
import { CommentsSection } from '../../comments';
import { PrivateJournalSection } from '../../private-journal/PrivateJournalSection.jsx';

import '../../../../static/js/pages/styles/MediaPage.scss';

const wideLayoutBreakpoint = 1216;

function isLoggedInUser() {
	if (typeof window === 'undefined') return false;
	return window.MediaCMS?.user?.is?.anonymous === false;
}

// Deep-links from the profile's "My Notes" page carry `?tab=notes` so the media
// page opens on the Your Notes tab rather than the default Comments tab. TabView
// clamps to a valid tab, so this safely no-ops for anonymous users (no Notes tab).
function requestedTab() {
	if (typeof window === 'undefined') return undefined;
	try {
		return new URLSearchParams(window.location.search).get('tab') === 'notes' ? 'your-notes' : undefined;
	} catch {
		return undefined;
	}
}

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
			commentsCount: 0,
			// Bumped when a playlist item replaces this one in place, so every media
			// section remounts as on a page load. The viewer container is kept: it
			// is the fullscreen element and must not change.
			mediaGeneration: 0,
		};

		this.viewerContainerRef = React.createRef();

		this.onWindowResize = this.onWindowResize.bind(this);
		this.onMediaLoad = this.onMediaLoad.bind(this);
		this.onMediaLoadError = this.onMediaLoadError.bind(this);
		this.onPagePlaylistLoad = this.onPagePlaylistLoad.bind(this);
		this.onNeedsPassword = this.onNeedsPassword.bind(this);
		this.onPasswordSuccess = this.onPasswordSuccess.bind(this);
		this.onCommentsCountChange = this.onCommentsCountChange.bind(this);
		this.onMediaSwitch = this.onMediaSwitch.bind(this);
		this.onViewerModeChange = this.onViewerModeChange.bind(this);

		MediaPageStore.on('loaded_media_data', this.onMediaLoad);
		MediaPageStore.on('switched_media', this.onMediaSwitch);
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
		MediaPageStore.removeListener('switched_media', this.onMediaSwitch);
		PageStore.removeListener('window_resize', this.onWindowResize);
		VideoViewerStore.removeListener('changed_viewer_mode', this.onViewerModeChange);
	}

	onMediaSwitch() {
		this.setState(
			(state) => ({
				mediaGeneration: state.mediaGeneration + 1,
				mediaLoaded: false,
				mediaLoadFailed: false,
				needsPassword: false,
				commentsCount: 0,
			}),
			() => MediaPageActions.loadMediaData()
		);
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
			VideoViewerStore.removeListener('changed_viewer_mode', this.onViewerModeChange);
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

	onCommentsCountChange(commentsCount) {
		if (this.state.commentsCount === commentsCount) {
			return;
		}

		this.setState({ commentsCount });
	}

	viewerContainerContent(mediaData) {
		return (
			<SiteConsumer>
				{(site) => (
					<VideoViewer
						key={this.state.mediaGeneration}
						data={mediaData}
						siteUrl={site.url}
						inEmbed={!1}
						fullscreenContainerRef={this.viewerContainerRef}
					/>
				)}
			</SiteConsumer>
		);
	}

	mediaType() {
		return 'video';
	}

	pageContent() {
		const viewerClassname = 'cf viewer-section' + (this.state.theaterMode ? ' theater-mode' : ' viewer-wide');
		const viewerNestedClassname = 'viewer-section-nested' + (this.state.theaterMode ? ' viewer-section' : '');
		const showPrivateJournal = isLoggedInUser();
		const generation = this.state.mediaGeneration;
		const commentsPanel = this.state.mediaLoaded ? (
			<div className="viewer-sidebar-comments mb-6 box-border w-full" key={'viewer-comments-' + generation}>
				<TabView
					tabMode="wrap"
					defaultSelectedTab={requestedTab()}
					listClassName="rounded-none rounded-tl-ds-8 rounded-tr-ds-8"
					triggerClassName="rounded-none py-3 px-size-24 text-text-tab-trigger aria-selected:text-text-primary"
					triggerSelectedColor="bg-bg-surface"
					panelClassName="mt-0 p-0 bg-bg-surface rounded-b-ds-8"
					aria-label="Video comments and notes"
					keepMounted
				>
					<TabContent title={`COMMENTS (${this.state.commentsCount})`} value="comments">
						<CommentsSection
							friendlyToken={MediaPageStore.get('media-id')}
							variant="sidebar"
							commentsDisabled={MediaPageStore.get('media-data')?.enable_comments === false}
							onCommentsCountChange={this.onCommentsCountChange}
						/>
					</TabContent>
					{showPrivateJournal ? (
						<TabContent title="YOUR NOTES" value="your-notes">
							<PrivateJournalSection friendlyToken={MediaPageStore.get('media-id')} />
						</TabContent>
					) : null}
				</TabView>
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
					<div className="viewer-container" key="viewer-container" ref={this.viewerContainerRef}>
						{this.state.mediaLoaded && this.state.pagePlaylistLoaded
							? this.viewerContainerContent(MediaPageStore.get('media-data'))
							: null}
					</div>,
					<div key="viewer-section-nested" className={viewerNestedClassname}>
						{!this.state.wideLayout || (this.state.isVideoMedia && this.state.theaterMode)
							? [
									<ViewerInfoVideo key={'viewer-info-' + generation} />,
									<div className="viewer-sidebar" key="viewer-sidebar-panel">
										{commentsPanel}
										{this.state.pagePlaylistLoaded ? (
											<ViewerSidebar
												key={'viewer-sidebar-' + generation}
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
												key={'viewer-sidebar-' + generation}
												mediaId={MediaPageStore.get('media-id')}
												playlistData={MediaPageStore.get('playlist-data')}
											/>
										) : null}
									</div>,
									<ViewerInfoVideo key={'viewer-info-' + generation} />,
								]}
					</div>,
				]}
			</div>
		);
	}
}
