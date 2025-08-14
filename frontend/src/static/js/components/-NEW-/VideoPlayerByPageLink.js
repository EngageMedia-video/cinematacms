import React, { useState, useEffect, useContext } from 'react';

import ApiUrlContext from '../../contexts/ApiUrlContext';
import SiteContext from '../../contexts/SiteContext';

import PropTypes from 'prop-types';

import UrlParse from 'url-parse';

import PageStore from '../../pages/_PageStore.js';

import { getRequest, postRequest } from '../../functions';

import { formatInnerLink, formatMediaLink } from '../../functions/formatInnerLink';

import { orderedSupportedVideoFormats, videoAvailableCodecsAndResolutions, extractDefaultVideoResolution } from '../MediaViewer/VideoViewer/functions';

import BrowserCache from '../../classes/BrowserCache.js';

import { VideoPlayer } from './VideoPlayer.js';

export function VideoPlayerByPageLink(props){

    const apiUrl = useContext( ApiUrlContext );
    const site = useContext( SiteContext );

	const [ errorType, setErrorType ] = useState(null);
	const [ errorMessage, setErrorMessage ] = useState(null);
	const [ videoPoster, setVideoPoster ] = useState(null);
	const [ videoSources, setVideoSources ] = useState([]);
	const [ videoResolutions, setVideoResolutions ] = useState({});
	const [ subtitlesInfo, setSubtitlesInfo ] = useState([]);
	const [ previewSprite, setPreviewSprite ] = useState({});
	const [ loading, setLoading ] = useState(false);

	// Keep cache data "fresh" for one day.
	const browserCache = new BrowserCache( site.id, 86400 );

	const playerStates = {
		videoQuality: browserCache.get('video-quality'),
	};

    playerStates.videoQuality = null !== playerStates.videoQuality ? playerStates.videoQuality : 'Auto';

    let apiRequestUrl = null;

	let data = null;
	let videoId = null;

	let urlParams = (function(){
        let ret = new UrlParse( props.pageLink ).query;
        if(! ret ){
            ret = [];
        }
        else{
            ret = ret.substring(1);
            ret.split("&");
            ret = ret.length ? ret.split("=") : [];
        }
        return ret;
    })();

    if( urlParams.length ){
        let i = 0;
        while( i < urlParams.length ){
            if( "m" === urlParams[i] ){ // @note: "m" is paramater name for media's id/token.
                videoId = urlParams[ i + 1 ];
            }
            i += 2;
        }
    }
    
    if( null !== videoId ){
		apiRequestUrl = apiUrl.media + '/' + videoId;
	}

	useEffect(() => {
		const fetchData = async () => {
			const data = await fetch(apiRequestUrl)
			.then((response) => response.json())
			.then((data) => {

				setLoading(true);

				let srcUrl, k;

				const videoSources = [];
				let videoPoster = null;
				let videoInfo = videoAvailableCodecsAndResolutions( data.encodings_info, data.hls_info );

				let errorType = null;
				let errorMessage = null;

				if( 'string' === typeof data.poster_url ){
					videoPoster = formatInnerLink( data.poster_url, site.url );
				}
				else if( 'string' === typeof data.thumbnail_url ){
					videoPoster = formatInnerLink( data.thumbnail_url, site.url );
				}

				const resolutionsKeys = Object.keys( videoInfo );

				if( ! resolutionsKeys.length ){
					videoInfo = null;
				}
				else{

					const supportedFormats = orderedSupportedVideoFormats();

					let defaultResolution = playerStates.videoQuality;

					if( null === defaultResolution || ( 'Auto' === defaultResolution && void 0 === videoInfo['Auto'] ) ){
						defaultResolution = 720;	// Default resolution.
					}

					let defaultVideoResolution = extractDefaultVideoResolution( defaultResolution, videoInfo );

					if( "Auto" === defaultResolution && void 0 !== videoInfo['Auto'] ){
						const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
						const srcUrl = formatMediaLink( videoInfo['Auto'].url[0], site.url, password );
						videoSources.push( { src: srcUrl } );
					}

					k = 0;
					while( k < videoInfo[ defaultVideoResolution ].format.length ){
						if( 'hls' === videoInfo[ defaultVideoResolution ].format[k] ){
							const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
							const srcUrl = formatMediaLink( videoInfo[ defaultVideoResolution ].url[k], site.url, password );
							videoSources.push( { src: srcUrl } );
							break;
						}
						k += 1;
					}

					for( k in data.encodings_info[ defaultVideoResolution ] ){

						if( data.encodings_info[ defaultVideoResolution].hasOwnProperty( k ) ){

							if( supportedFormats.support[k] ){

								srcUrl = data.encodings_info[ defaultVideoResolution][k].url;

								if( !! srcUrl ){	// @note: In some cases, url value is 'null'.

									// Get password for restricted media if available
									const password = (typeof MediaCMS !== 'undefined' && MediaCMS.provided_password) ? MediaCMS.provided_password : null;
									srcUrl = formatMediaLink( srcUrl, site.url, password );

									videoSources.push({
										src: srcUrl,
										encodings_status: data.encodings_info[ defaultVideoResolution ][k].status,
									});
								}
							}
						}
					}
				}
				
				if( 1 === videoSources.length && 'running' === videoSources[0].encodings_status ){
					errorType = 'encodingRunning';
					errorMessage = 'Media encoding is currently running. Try again in few minutes.';
				}
				
				if( null !== errorType ){
				
					switch( errorType ){
						case "encodingRunning":
						case "encodingPending":
						case "encodingFailed":
							break;
						default:
							console.warn( "VIDEO DEBUG:", "Video files don't exist" );
					}
				}

				setErrorType(errorType);
				setErrorMessage(errorMessage);
				setVideoPoster(videoPoster);
				setVideoSources(videoSources);
				setVideoResolutions(videoInfo);
				setSubtitlesInfo(data.subtitles_info);
				setPreviewSprite(!! data.sprites_url ? { url: formatInnerLink( data.sprites_url, site.url ), frame: { width: 160, height: 90, seconds: 10 }, } : null);

				const featuredItemDescrContent = document.querySelector('.feat-first-item .item .item-description > div');

				if( featuredItemDescrContent ){
					// featuredItemDescrContent.innerHTML = data.summary + '<br/><br/>' + data.description;
					featuredItemDescrContent.innerHTML = data.summary;
				}

				setLoading(false);
			});
			return data;
		};

		fetchData();
	}, []);

	if (loading)
	{
		return null;
	}

	return ( videoSources.length ? <div className="video-player">
				<VideoPlayer
					siteId={ site.id }
					siteUrl={ site.url }
					info={ videoResolutions }
					sources={ videoSources }
					poster={ videoPoster }
					previewSprite={ previewSprite }
					subtitlesInfo={ subtitlesInfo }
					enableAutoplay={ false }
					inEmbed={ false }
					hasTheaterMode={ false }
					hasNextLink={ false }
					hasPreviousLink={ false }
					errorMessage={ errorMessage } />
			</div> : null );
}

VideoPlayerByPageLink.propTypes = {
	pageLink: PropTypes.string.isRequired,
};