import React, { useState, useEffect } from 'react';

import * as PageActions from './_PageActions';

import VideoViewer from '../components/MediaViewer/VideoViewer';

import { SiteConsumer } from '../contexts/SiteContext';

import MediaPageStore from './MediaPage/store.js';
import * as MediaPageActions from './MediaPage/actions.js';

import "./styles/EmbedPage.scss";

// TODO: Recheck component.

export function EmbedPage(){

	const [ loadedVideo, setLoadedVideo ] = useState( false );
	/*const [ loadedAudio, setLoadedAudio ] = useState( false );
	const [ loadedImage, setLoadedImage ] = useState( false );*/
	const [ failedMediaLoad, setFailedMediaLoad ] = useState( false );

	function onLoadedVideoData(){
		setLoadedVideo(true);
	}

	/*function onLoadedAudioData(){
		setLoadedAudio(true);
	}

	function onLoadedImageData(){
		setLoadedImage(true);
	}*/

	function onMediaLoadError(){
		setFailedMediaLoad(true);
	}

    useEffect(() => {

    	PageActions.initPage('embed');

    	MediaPageStore.on('loaded_video_data', onLoadedVideoData);
    	/*MediaPageStore.on('loaded_audio_data', onLoadedAudioData);
		MediaPageStore.on('loaded_image_data', onLoadedImageData);*/
		MediaPageStore.on('loaded_media_error', onMediaLoadError);

		MediaPageActions.loadMediaData();
        
        return () => {
	    	MediaPageStore.removeListener('loaded_video_data', onLoadedVideoData);
	    	/*MediaPageStore.removeListener('loaded_audio_data', onLoadedAudioData);
			MediaPageStore.removeListener('loaded_image_data', onLoadedImageData);*/
			MediaPageStore.removeListener('loaded_media_error', onMediaLoadError);
        };
    }, []);

	return ( <div className='embed-wrap'>
				{ failedMediaLoad ? <div className="player-container player-container-error">
										<div className="player-container-inner">
											<div className="error-container">
												<div className="error-container-inner">
													<span className="icon-wrap"><i className="material-icons">error_outline</i></span>
													<span className="msg-wrap">{ MediaPageStore.get('media-load-error-message') }</span>
												</div>
											</div>
										</div>
									</div> : null }
				{ loadedVideo ? <SiteConsumer>{ site => <VideoViewer data={ MediaPageStore.get( 'media-data' ) } siteUrl={ site.url } /> }</SiteConsumer> : null }
				{ /*loadedAudio ?  : null*/ }
				{ /*loadedImage ?  : null*/ }
			</div> );
}
