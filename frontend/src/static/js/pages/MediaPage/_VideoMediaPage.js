import React from 'react';
import ReactDOM from 'react-dom';

import { Page } from '../_Page';
import PageStore from '../_PageStore';

import MediaPageStore from './store.js';
import * as MediaPageActions from './actions.js';
import ViewerInfoVideo from './includes/ViewerInfoVideo';
import ViewerError from './includes/ViewerError';
import ViewerSidebar from './includes/ViewerSidebar';

import VideoViewerStore from '../../components/MediaViewer/VideoViewer/store.js';   // @note: Is usable only in case of video media, but is included in every media page code.

import "../styles/MediaPage.scss";

const wideLayoutBreakpoint = 1216;

export class _VideoMediaPage extends Page {

    constructor(props){

        super(props, 'media');

        this.state = {
            wideLayout: wideLayoutBreakpoint <= PageStore.get('window-inner-width'),
            mediaLoaded: false,
            mediaLoadFailed: false,
            isVideoMedia: false,
            theaterMode: false,     // @note: Is usable only in case of video media, but is included in every media page code.
            pagePlaylistLoaded: false,
            pagePlaylistData: MediaPageStore.get('playlist-data'),
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
        PageStore.on( 'window_resize', this.onWindowResize );   // @todo: Is not neccessary to check on every window dimension for changes...
    }

    onWindowResize(){
        this.setState({
            wideLayout: wideLayoutBreakpoint <= PageStore.get('window-inner-width'),
        });
    }

    onPagePlaylistLoad(){
        this.setState({
            pagePlaylistLoaded: true,
            pagePlaylistData: MediaPageStore.get('playlist-data'),
        });
    }

    onMediaLoad(){

        const isVideoMedia = 'video' === MediaPageStore.get( 'media-type' );

        if( isVideoMedia ){

            this.onViewerModeChange = this.onViewerModeChange.bind(this);

            VideoViewerStore.on( 'changed_viewer_mode', this.onViewerModeChange );

            this.setState({
                mediaLoaded: true,
                isVideoMedia: isVideoMedia,
                theaterMode: VideoViewerStore.get('in-theater-mode')
            });
        }
        else{
            this.setState({
                mediaLoaded: true,
                isVideoMedia: isVideoMedia,
            });
        }
    }

    onViewerModeChange(){
        this.setState({ theaterMode: VideoViewerStore.get('in-theater-mode') });
    }

    onMediaLoadError(a){
        this.setState({ mediaLoadFailed: true });
    }

    pageContent(){

        // console.log( "!!!", MediaPageStore.get('playlist-data') );
        // console.log( "!!!", this.state.pagePlaylistData );

        const viewerClassname = 'cf viewer-section' + ( this.state.theaterMode ? ' theater-mode' : ' viewer-wide' );
        const viewerNestedClassname = 'viewer-section-nested' + ( this.state.theaterMode ? ' viewer-section' : '' );

        return this.state.mediaLoadFailed ?
                <div className={ viewerClassname }><ViewerError/></div> :
                <div className={ viewerClassname }>{[
                    <div className="viewer-container" key="viewer-container">{ this.state.mediaLoaded && this.state.pagePlaylistLoaded ? this.viewerContainerContent( MediaPageStore.get('media-data') ) : null }</div>,
                    <div key="viewer-section-nested" className={ viewerNestedClassname }>
                        { ! this.state.wideLayout || ( this.state.isVideoMedia && this.state.theaterMode ) ?
                            [ <ViewerInfoVideo key="viewer-info"/>, this.state.pagePlaylistLoaded ? <ViewerSidebar key="viewer-sidebar" mediaId={ MediaPageStore.get('media-id') } playlistData={ MediaPageStore.get('playlist-data') } /> : null ] :
                            [ this.state.pagePlaylistLoaded ? <ViewerSidebar key="viewer-sidebar" mediaId={ MediaPageStore.get('media-id') } playlistData={ MediaPageStore.get('playlist-data') } /> : null, <ViewerInfoVideo key="viewer-info"/> ]
                        }
                    </div>
                ]}</div>;
    }
}
