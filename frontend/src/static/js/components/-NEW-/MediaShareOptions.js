import React, { useRef, useState, useEffect } from 'react';

import LayoutStore from '../../stores/LayoutStore.js';

import PageStore from '../../pages/_PageStore.js';
import * as PageActions from '../../pages/_PageActions.js';

import MediaPageStore from '../../pages/MediaPage/store.js';
import * as MediaPageActions from '../../pages/MediaPage/actions.js';

import ItemsInlineSlider from "./includes/itemLists/ItemsInlineSlider";

import { MaterialIcon } from './MaterialIcon';
import { CircleIconButton } from './CircleIconButton';

import ShareOptionsContext from '../../contexts/ShareOptionsContext';

/*
 * https://simplesharebuttons.com/html-share-buttons/
 * https://github.com/bradvin/social-share-urls
 */

function shareOptionsList(){

	const socialMedia = ShareOptionsContext._currentValue;
	const mediaUrl = MediaPageStore.get( 'media-url' );
	const mediaTitle = MediaPageStore.get('media-data').title;
	
	const ret = {};

	let i = 0;

	while( i < socialMedia.length){

		switch( socialMedia[i] ){
			
			case 'embed':
				if( 'video' === MediaPageStore.get('media-data').media_type ){
					ret[ socialMedia[i] ] = {};
				}
				break;
			case 'email':
				ret[ socialMedia[i] ] = {
					title: 'Email',
					shareUrl: "mailto:?body="+ mediaUrl,
				};
				break;
			case 'fb':
				ret[ socialMedia[i] ] = {
					title: 'Facebook',
					shareUrl: 'https://www.facebook.com/sharer.php?u=' + mediaUrl,
				};
				break;
			case 'tw':
				ret[ socialMedia[i] ] = {
					title: 'Twitter',
					shareUrl: 'https://twitter.com/intent/tweet?url=' + mediaUrl,
				};
				break;
			case 'reddit':
				ret[ socialMedia[i] ] = {
					title: 'reddit',
					shareUrl: 'https://reddit.com/submit?url=' + mediaUrl + '&title=' + mediaTitle,
				};
				break;
			case 'tumblr':
				ret[ socialMedia[i] ] = {
					title: 'Tumblr',
					shareUrl: 'https://www.tumblr.com/widgets/share/tool?canonicalUrl=' + mediaUrl + '&title=' + mediaTitle,
				};
				break;
			case 'pinterest':
				ret[ socialMedia[i] ] = {
					title: 'Pinterest',
					shareUrl: 'http://pinterest.com/pin/create/link/?url=' + mediaUrl,
				};
				break;
			case 'vk':
				ret[ socialMedia[i] ] = {
					title: 'ВКонтакте',
					shareUrl: 'http://vk.com/share.php?url=' + mediaUrl + '&title=' + mediaTitle,
				};
				break;
			case 'linkedin':
				ret[ socialMedia[i] ] = {
					title: 'LinkedIn',
					shareUrl: 'https://www.linkedin.com/shareArticle?mini=true&url=' + mediaUrl,
				};
				break;
			case 'mix':
				ret[ socialMedia[i] ] = {
					title: 'Mix',
					shareUrl: 'https://mix.com/add?url=' + mediaUrl,
				};
				break;
			case 'whatsapp':
				ret[ socialMedia[i] ] = {
					title: 'WhatsApp',
					shareUrl: 'whatsapp://send?text=' + mediaUrl,
				};
				break;
			case 'telegram':
				ret[ socialMedia[i] ] = {
					title: 'Telegram',
					shareUrl: 'https://t.me/share/url?url=' + mediaUrl + '&text=' + mediaTitle,
				};
				break;
		}

		i += 1;
	}

	return ret;
}

function ShareOptions(){

	const shareOptions = shareOptionsList();

	const compList = [];

	for(let k in shareOptions){

		if( shareOptions.hasOwnProperty( k ) ){

			if( k === 'embed' ){
				compList.push( <div key={ "share-" + k } className={ "sh-option share-" + k + '-opt' }>
									<button className="sh-option change-page" data-page-id="shareEmbed">
										<span><i className="material-icons">code</i></span>
										<span>Embed</span>
									</button>
								</div> );
			}
			else if( k === 'whatsapp' ){
				compList.push( <div key={ "share-" + k } className={ "sh-option share-" + k }>
									<a href={ shareOptions[k].shareUrl } title="" target="_blank" data-action='share/whatsapp/share'>
										<span></span>
										<span>{ shareOptions[k].title }</span>
									</a>
								</div> );
			}
			else if( k === 'email' ){
				compList.push( <div key="share-email" className="sh-option share-email">
									<a href={ shareOptions[k].shareUrl } title="">
										<span><i className="material-icons">email</i></span>
										<span>{ shareOptions[k].title }</span>
									</a>
								</div> );
			}
			else{
				compList.push( <div key={ "share-" + k } className={ "sh-option share-" + k }>
									<a href={ shareOptions[k].shareUrl } title="" target="_blank">
										<span></span>
										<span>{ shareOptions[k].title }</span>
									</a>
								</div> );
			}
		}
	}

	return compList;
}

function NextSlideButton({onClick}){
	return ( <span className="next-slide"><CircleIconButton buttonShadow={true} onClick={ onClick }><i className="material-icons">keyboard_arrow_right</i></CircleIconButton></span> );
}

function PreviousSlideButton({onClick}){
	return( <span className="previous-slide"><CircleIconButton buttonShadow={true} onClick={ onClick }><i className="material-icons">keyboard_arrow_left</i></CircleIconButton></span> );
}

function updateDimensions(){
	return {
		maxFormContentHeight: LayoutStore.get('container-height') - ( 56 + ( 4 * 24 ) + 44 ),
		maxPopupWidth: 518 > LayoutStore.get('container-width') - ( 2 * 40 ) ? LayoutStore.get('container-width') - ( 2 * 40 ) : null,
	};
}

function getTimestamp() {
	const videoPlayer = document.getElementsByTagName("video");
	return videoPlayer[0]?.currentTime;
  }
  
  function ToHHMMSS (timeInt) {
	let sec_num = parseInt(timeInt, 10);
	let hours   = Math.floor(sec_num / 3600);
	let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	let seconds = sec_num - (hours * 3600) - (minutes * 60);
  
	if (hours   < 10) {hours   = "0"+hours;}
	if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) {seconds = "0"+seconds;}
	return hours >= 1 ? hours + ':' + minutes + ':' + seconds : minutes + ':' + seconds;
  }
  
export function MediaShareOptions(props){

	const containerRef = useRef(null);
	const shareOptionsInnerRef = useRef(null);
	const mediaUrl = MediaPageStore.get('media-url');

	const [ inlineSlider, setInlineSlider ] = useState( null );
	const [ sliderButtonsVisible, setSliderButtonsVisible ] = useState({ prev: false, next: false });

	const [ dimensions, setDimensions ] = useState( updateDimensions() );
	const [ shareOptions ] = useState( ShareOptions() );

	const [timestamp, setTimestamp] = useState(0);
	const [formattedTimestamp, setFormattedTimestamp] = useState(0);
	const [startAtSelected, setStartAtSelected] = useState(false);
  
	const [shareMediaLink, setShareMediaLink] = useState(mediaUrl);

	function  onWindowResize(){
		setDimensions(updateDimensions());
	}

	function onClickCopyMediaLink(){
		MediaPageActions.copyShareLink( containerRef.current.querySelector('.copy-field input') );
	}

	function onCompleteCopyMediaLink(){
		// TODO: Re-check this.
		setTimeout(function(){	// @note: Without delay throws conflict error [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
			PageActions.addNotification("Link copied to clipboard", 'clipboardLinkCopy');
		}, 100);
	}

	function updateSlider(){
		inlineSlider.scrollToCurrentSlide();
		updateSliderButtonsView();
	}

	function updateSliderButtonsView(){
		setSliderButtonsVisible({
			prev: inlineSlider.hasPreviousSlide(),
			next: inlineSlider.hasNextSlide(),
		});
	}

	function updateStartAtCheckbox() {
		setStartAtSelected(!startAtSelected);
		updateShareMediaLink();
	  }
	
	  function updateShareMediaLink()
	  {
		  const newLink = startAtSelected ? mediaUrl : mediaUrl + "&t=" + Math.trunc(timestamp);
		  setShareMediaLink(newLink);
	  }
	
	function nextSlide(){
		inlineSlider.nextSlide();
		updateSlider();
	}

	function prevSlide(){
		inlineSlider.previousSlide();
		updateSlider();
	}

	useEffect(()=>{
		setInlineSlider( new ItemsInlineSlider( shareOptionsInnerRef.current, '.sh-option' ) );
	}, [shareOptions]);

	useEffect(()=>{
		if( inlineSlider ){
			inlineSlider.updateDataStateOnResize( shareOptions.length, true, true );
			updateSlider();
		}
	}, [dimensions, inlineSlider]);

	useEffect(()=>{

		PageStore.on( 'window_resize', onWindowResize );
		MediaPageStore.on( "copied_media_link", onCompleteCopyMediaLink );

		const localTimestamp = getTimestamp();
		setTimestamp(localTimestamp);
		setFormattedTimestamp(ToHHMMSS(localTimestamp));
		
		return () => {
			PageStore.removeListener( 'window_resize', onWindowResize );
			MediaPageStore.removeListener( "copied_media_link", onCompleteCopyMediaLink );
			setInlineSlider(null);
		};
	}, []);

	return (<div ref={containerRef} style={ null !== dimensions.maxPopupWidth ? { 'maxWidth' : dimensions.maxPopupWidth + 'px' } : null }>
					<div className="scrollable-content" style={ null !== dimensions.maxFormContentHeight ? { 'maxHeight' : dimensions.maxFormContentHeight + 'px' } : null }>
						<div className="share-popup-title">Share media</div>
						{ shareOptions.length ? <div className="share-options">
							{ sliderButtonsVisible.prev ? <PreviousSlideButton onClick={ prevSlide } /> : null }
							<div ref={ shareOptionsInnerRef } className="share-options-inner">{ shareOptions }</div>
							{ sliderButtonsVisible.next ? <NextSlideButton onClick={ nextSlide } /> : null }
						</div> : null }
					</div>
					<div className="copy-field">
						<div>
							<input type="text" readOnly value={shareMediaLink} />
							<button onClick={ onClickCopyMediaLink }>COPY</button>
						</div>
					</div>

					<div className="start-at">
					<label>
						<input 
						type="checkbox" 
						name="start-at-checkbox" 
						id="id-start-at-checkbox"
						checked={startAtSelected} 
						onChange={updateStartAtCheckbox}
						/>
						Start at {formattedTimestamp}
					</label>
					</div>


				</div>);
}
