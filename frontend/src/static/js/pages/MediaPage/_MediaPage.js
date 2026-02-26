import React from 'react';
import ReactDOM from 'react-dom';

import { Page } from '../_Page';
import PageStore from '../_PageStore';

import MediaPageStore from './store.js';
import * as MediaPageActions from './actions.js';

import ViewerError from './includes/ViewerError';
import ViewerInfo from './includes/ViewerInfo';
import ViewerSidebar from './includes/ViewerSidebar';

import "../styles/MediaPage.scss";

const wideLayoutBreakpoint = 1216;

export class _MediaPage extends Page {

	constructor(props){

		super(props, 'media');

		const isWideLayout = wideLayoutBreakpoint <= PageStore.get('window-inner-width');
		
		this.state = {
			mediaLoaded: false,
			mediaLoadFailed: false,
			wideLayout: isWideLayout,
			infoAndSidebarViewType: ! isWideLayout ? 0 : 1,
			viewerClassname: 'cf viewer-section viewer-wide',
			viewerNestedClassname: 'viewer-section-nested',
			pagePlaylistLoaded: false,
		};

		this.onWindowResize = this.onWindowResize.bind(this);
		this.onMediaLoad = this.onMediaLoad.bind(this);
		this.onMediaLoadError = this.onMediaLoadError.bind(this);
		this.onPagePlaylistLoad = this.onPagePlaylistLoad.bind(this);
		
		MediaPageStore.on('loaded_media_data', this.onMediaLoad);
		MediaPageStore.on('loaded_media_error', this.onMediaLoadError);
		MediaPageStore.on('loaded_page_playlist_data', this.onPagePlaylistLoad);
	}

	componentDidMount() {
		MediaPageActions.loadMediaData();
		PageStore.on( 'window_resize', this.onWindowResize );	// @todo: Is not neccessary to check on every window dimension for changes...
	}

	onPagePlaylistLoad(){
		this.setState({
			pagePlaylistLoaded: true,
		});
	}

	onWindowResize(){

		const isWideLayout = wideLayoutBreakpoint <= PageStore.get('window-inner-width');

		this.setState({ 
			wideLayout: isWideLayout,
			infoAndSidebarViewType: ! isWideLayout || ( MediaPageStore.isVideo() && this.state.theaterMode ) ? 0 : 1,
		});
	}

	onMediaLoad(){
		this.setState({ mediaLoaded: true });
	}

	onMediaLoadError(){
		this.setState({ mediaLoadFailed: true });
	}

	viewerContainerContent(){
		return null;
	}

    mediaType(){
    	return null;
    }

	pageContent(){
		return this.state.mediaLoadFailed ?
				<div className={ this.state.viewerClassname }><ViewerError/></div> :
				<div className={ this.state.viewerClassname }>
					<div className="viewer-container" key="viewer-container">{ this.state.mediaLoaded ? this.viewerContainerContent() : null }</div>
					<div key="viewer-section-nested" className={ this.state.viewerNestedClassname }>
						{ ! this.state.infoAndSidebarViewType ? [ <ViewerInfo key="viewer-info"/>, this.state.pagePlaylistLoaded ? <ViewerSidebar key="viewer-sidebar" mediaId={ MediaPageStore.get('media-id') } playlistData={ MediaPageStore.get('playlist-data') } /> : null ] : [ this.state.pagePlaylistLoaded ? <ViewerSidebar key="viewer-sidebar" mediaId={ MediaPageStore.get('media-id') } playlistData={ MediaPageStore.get('playlist-data') } /> : null, <ViewerInfo key="viewer-info"/> ] }
					</div>
				</div>;
	}
}