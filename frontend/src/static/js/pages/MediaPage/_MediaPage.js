import React from 'react';
import ReactDOM from 'react-dom';

import { Page } from '../_Page';
import PageStore from '../_PageStore';

import MediaPageStore from './store.js';
import * as MediaPageActions from './actions.js';

import ViewerError from './includes/ViewerError';
import ViewerInfo from './includes/ViewerInfo';
import ViewerSidebar from './includes/ViewerSidebar';
import { PasswordDialog } from '../../../../features/shared/components/PasswordDialog';

import '../styles/MediaPage.scss';

const wideLayoutBreakpoint = 1216;

export class _MediaPage extends Page {
	constructor(props) {
		super(props, 'media');

		const isWideLayout = wideLayoutBreakpoint <= PageStore.get('window-inner-width');

		this.state = {
			mediaLoaded: false,
			mediaLoadFailed: false,
			wideLayout: isWideLayout,
			infoAndSidebarViewType: !isWideLayout ? 0 : 1,
			viewerClassname: 'cf viewer-section viewer-wide',
			viewerNestedClassname: 'viewer-section-nested',
			pagePlaylistLoaded: false,
			needsPassword: false,
			passwordDialogOpen: false,
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
		PageStore.on('window_resize', this.onWindowResize); // @todo: Is not neccessary to check on every window dimension for changes...
	}

	onPagePlaylistLoad() {
		this.setState({
			pagePlaylistLoaded: true,
		});
	}

	onWindowResize() {
		const isWideLayout = wideLayoutBreakpoint <= PageStore.get('window-inner-width');

		this.setState({
			wideLayout: isWideLayout,
			infoAndSidebarViewType: !isWideLayout || (MediaPageStore.isVideo() && this.state.theaterMode) ? 0 : 1,
		});
	}

	onMediaLoad() {
		this.setState({ mediaLoaded: true });
	}

	onMediaLoadError() {
		this.setState({ mediaLoadFailed: true });
	}

	onNeedsPassword() {
		this.setState({ needsPassword: true, passwordDialogOpen: true });
	}

	onPasswordSuccess(token) {
		MediaCMS.access_token = token;
		MediaCMS.media_restricted = false;
		this.setState({ needsPassword: false, passwordDialogOpen: false });
		MediaPageActions.loadMediaData();
	}

	restrictedContent() {
		return (
			<div className={this.state.viewerClassname}>
				<div className="viewer-container" key="viewer-container">
					<div className="restricted-media-placeholder">
						<i className="material-icons">lock</i>
						<h2>This media is password protected</h2>
						<p>Enter the password to view this media.</p>
						<button onClick={() => this.setState({ passwordDialogOpen: true })}>Enter Password</button>
					</div>
				</div>
				<PasswordDialog
					open={this.state.passwordDialogOpen}
					onOpenChange={(open) => this.setState({ passwordDialogOpen: open })}
					friendlyToken={MediaCMS.media_friendly_token || MediaCMS.mediaId}
					onSuccess={this.onPasswordSuccess}
					onClose={() => this.setState({ passwordDialogOpen: false })}
				/>
			</div>
		);
	}

	viewerContainerContent() {
		return null;
	}

	mediaType() {
		return null;
	}

	pageContent() {
		if (this.state.needsPassword) {
			return this.restrictedContent();
		}

		return this.state.mediaLoadFailed ? (
			<div className={this.state.viewerClassname}>
				<ViewerError />
			</div>
		) : (
			<div className={this.state.viewerClassname}>
				<div className="viewer-container" key="viewer-container">
					{this.state.mediaLoaded ? this.viewerContainerContent() : null}
				</div>
				<div key="viewer-section-nested" className={this.state.viewerNestedClassname}>
					{!this.state.infoAndSidebarViewType
						? [
								<ViewerInfo key="viewer-info" />,
								this.state.pagePlaylistLoaded ? (
									<ViewerSidebar
										key="viewer-sidebar"
										mediaId={MediaPageStore.get('media-id')}
										playlistData={MediaPageStore.get('playlist-data')}
									/>
								) : null,
							]
						: [
								this.state.pagePlaylistLoaded ? (
									<ViewerSidebar
										key="viewer-sidebar"
										mediaId={MediaPageStore.get('media-id')}
										playlistData={MediaPageStore.get('playlist-data')}
									/>
								) : null,
								<ViewerInfo key="viewer-info" />,
							]}
				</div>
			</div>
		);
	}
}
