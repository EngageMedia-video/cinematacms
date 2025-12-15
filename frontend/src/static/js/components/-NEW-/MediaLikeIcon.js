import React, { useState, useRef, useEffect } from 'react';

import TextsContext from '../../contexts/TextsContext';
import LinksContext from '../../contexts/LinksContext';
import UserContext from '../../contexts/UserContext';
import SiteContext from '../../contexts/SiteContext';

import * as PageActions from '../../pages/_PageActions.js';

import MediaPageStore from '../../pages/MediaPage/store.js';
import * as MediaPageActions from '../../pages/MediaPage/actions.js';

import { CircleIconButton } from './CircleIconButton';
import { MaterialIcon } from './MaterialIcon';

import { formatNumber } from '../../functions';

export function MediaLikeIcon(props){

	const counterRef = useRef(null);

	const [ likedMedia, setLikedMedia ] = useState( MediaPageStore.get('user-liked-media') );
	const [ likesCounter, setLikesCounter ] = useState( formatNumber( MediaPageStore.get('media-likes'), false ) );

	function updateStateValues(){
		setLikedMedia( MediaPageStore.get('user-liked-media') );
		setLikesCounter( formatNumber( MediaPageStore.get('media-likes'), false ) );
	}

	function onCompleteMediaLike(){
		updateStateValues();
		PageActions.addNotification( TextsContext._currentValue.addToLiked, 'likedMedia' );
	}

	function onCompleteMediaLikeCancel(){
		updateStateValues();
		PageActions.addNotification( TextsContext._currentValue.removeFromLiked, 'unlikedMedia' );
	}

	function onFailMediaLikeRequest(){
		PageActions.addNotification("Action failed", 'likedMediaRequestFail');
	}

	function toggleLike(ev){
		ev.preventDefault();
		ev.stopPropagation();

		// Redirect anonymous users to sign-in page
		if (UserContext._currentValue.is.anonymous) {
			const currentPath = window.location.href.replace(SiteContext._currentValue.url, '').replace(/^\//g, '');
			const loginUrl = LinksContext._currentValue.signin + '?next=/' + currentPath;
			window.location.href = loginUrl;
			return;
		}

		MediaPageActions[ likedMedia ? 'unlikeMedia' : 'likeMedia' ]();
	}

	useEffect( () => {
		MediaPageStore.on( "liked_media", onCompleteMediaLike );
		MediaPageStore.on( "unliked_media", onCompleteMediaLikeCancel );
		MediaPageStore.on( "liked_media_failed_request", onFailMediaLikeRequest );
		return () => {
			MediaPageStore.removeListener( "liked_media", onCompleteMediaLike );
			MediaPageStore.removeListener( "unliked_media", onCompleteMediaLikeCancel );
			MediaPageStore.removeListener( "liked_media_failed_request", onFailMediaLikeRequest );
		};
	}, []);

	return ( <div className="like">
				<button onClick={ toggleLike }>
					<CircleIconButton type="span"><MaterialIcon type="thumb_up" /></CircleIconButton>
					<span className="likes-counter">{ likesCounter }</span>
				</button>
		   </div> );
}