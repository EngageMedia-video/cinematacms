import React, { useEffect, useRef, useState, useContext } from 'react';

import UserContext from '../../../contexts/UserContext';
import ApiUrlContext from '../../../contexts/ApiUrlContext';

import PageStore from '../../../pages/_PageStore.js';
import LayoutStore from '../../../stores/LayoutStore.js';

import { SearchField } from "../SearchField";
import { HeaderRight } from './HeaderRight';
import { HeaderLeft } from './HeaderLeft';
import TopMessage from '../TopMessage';
import HomepagePopup from "../HomepagePopup";

import { addClassname } from '../functions/dom';

// @note: Include in Header component the global styles so that they'll be included into every page.

import "../../../../css/styles.scss";

import "../../styles/PageHeader.scss";

// @note: Include also Main component's styles so that they'll be included into every page.
import "../../styles/PageMain.scss";

function Alerts(){

    function onClickAlertClose(){

        const alertElem = this.parentNode;

        addClassname( alertElem, 'hiding' );

        setTimeout( (function(){

            if ( alertElem && alertElem.parentNode ){
                alertElem.parentNode.removeChild(alertElem);
            }

        }).bind(this), 400 );
    }

    setTimeout( (function(){

        const closeBtn = document.querySelectorAll('.alert.alert-dismissible .close');

        let i;
        if( closeBtn.length ){
            i = 0;
            while( i < closeBtn.length ){
                closeBtn[i].addEventListener( "click", onClickAlertClose );
                i += 1;
            }
        }

    }).bind(this), 1000 ); // @todo: Recheck this.
}

function MediaUploader(){

    let uploaderWrap = document.querySelector('.media-uploader-wrap');

    if( uploaderWrap ){

        let preUploadMsgEl = document.createElement('div');

        preUploadMsgEl.setAttribute( "class", "pre-upload-msg" );
        preUploadMsgEl.innerHTML = PageStore.get('config-contents').uploader.belowUploadArea;

        uploaderWrap.appendChild( preUploadMsgEl );
    }
}

export function PageHeader(props){
	const topMessageTextStorageKey = 'MediaCMS["top-message-text"]';
	const topMessageDisplayedStorageKey = 'MediaCMS["top-message-has-been-displayed"]';

	const homepagePopupTextStorageKey = 'MediaCMS["homepage-popup"]';
	const homepagePopupDisplayedStorageKey =
		'MediaCMS["homepage-popup-has-been-displayed"]';

	//let apiRequestUrl = null;
	const apiUrl = useContext(ApiUrlContext);
	let [topMessageText, setTopMessageText] = useState(
		() => {
			return window.localStorage.getItem(topMessageTextStorageKey);
		}
	);
	let [ topMessageHasBeenDisplayed, setTopMessageHasBeenDisplayed ] = useState(
		() => {
			return window.localStorage.getItem(topMessageDisplayedStorageKey) || "true";
		}
	);

	let [homepagePopupText, setHomepagePopupText] = useState(() => {
		// show HomePage popup on home page only
		if (window.location.pathname !== '/') {
			return true;
		}
		return window.localStorage.getItem(homepagePopupTextStorageKey);
	});
	let [homepagePopupHasBeenDisplayed, setHomepagePopupHasBeenDisplayed] =
		useState(() => {
			return (
				window.localStorage.getItem(homepagePopupDisplayedStorageKey) || "false"
			);
		});

	useEffect(() => {
		fetch(apiUrl.topmessage)
		.then(response => response.json())
		.then(data => {
			if (data.active === true)
			{
				if (window.localStorage.getItem(topMessageTextStorageKey) !== data.text)
				{
					setTopMessageText(data.text);
					setTopMessageHasBeenDisplayed("false");
					window.localStorage.setItem(topMessageTextStorageKey, data.text);
					window.localStorage.setItem(topMessageDisplayedStorageKey, "false");
				}
			}
		})

		// show HomePage popup on home page only
		let getHomepagePopup = false

		if (window.location.pathname === '/') {
			getHomepagePopup = true
		}

		getHomepagePopup && fetch(apiUrl.homepagepopup)
			.then((response) => response.json())
			.then((data) => {
				if (window.localStorage.getItem(homepagePopupTextStorageKey) !== JSON.stringify(data)) {
					setHomepagePopupText(data);
					setHomepagePopupHasBeenDisplayed("false");
					window.localStorage.setItem(
						homepagePopupTextStorageKey,
						JSON.stringify(data)
					);
					window.localStorage.setItem(homepagePopupDisplayedStorageKey, "false");
				}
			});

	},[])

	const [ mobileSearchField, setMobileSearchField ] = useState( LayoutStore.get('visible-mobile-search') );

	function onChangedMobileSearchFieldVisibility(){
		setMobileSearchField( LayoutStore.get('visible-mobile-search') );
	}

	const closeAlert = () =>  {

		if (topMessageText)
		{
			setTopMessageHasBeenDisplayed("true");
			window.localStorage.setItem(topMessageTextStorageKey, topMessageText);
			window.localStorage.setItem(topMessageDisplayedStorageKey, "true");
		}
	}

	const closeHomepagePopup = () => {
		if (homepagePopupText) {
			setHomepagePopupHasBeenDisplayed("true");
			window.localStorage.setItem(
				homepagePopupTextStorageKey,
				JSON.stringify(homepagePopupText)
			);
			window.localStorage.setItem(homepagePopupDisplayedStorageKey, "true");
		}
	};

	useEffect( () => {

		LayoutStore.on( 'mobile-search-visibility-change', onChangedMobileSearchFieldVisibility );

		Alerts();

        if( void 0 === PageStore.get( 'current-page' ) || "add-media" === PageStore.get( 'current-page' ) ){
            MediaUploader();
        }

		return () => LayoutStore.removeListener( 'mobile-search-visibility-change', onChangedMobileSearchFieldVisibility );

	}, []);

	useEffect(() => {
		if (topMessageHasBeenDisplayed === "false") {
			document.body.classList.add("top-message-body");
		} else {
			document.body.classList.remove("top-message-body");
		}

	}, [topMessageHasBeenDisplayed, topMessageText]);

	return (
		<header className= { "page-header" + ( mobileSearchField ? " mobile-search-field" : "" ) + ( UserContext._currentValue.is.anonymous ? ' anonymous-user' : '' ) }>
			{(topMessageHasBeenDisplayed !== "true" && topMessageText !== null) && <TopMessage message={topMessageText} onClick={closeAlert} />}

			{homepagePopupHasBeenDisplayed !== "true" && homepagePopupText !== null && (
				<HomepagePopup message={homepagePopupText} onClick={closeHomepagePopup} />
			)}

			<HeaderLeft/>
			<SearchField/>
			<HeaderRight/>

		</header>
	);
}
