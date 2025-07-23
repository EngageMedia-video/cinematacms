import React, { useState, useRef, useEffect } from 'react';

import TextsContext from '../../contexts/TextsContext';

import * as PageActions from '../../pages/_PageActions.js';

import MediaPageStore from '../../pages/MediaPage/store.js';
import * as MediaPageActions from '../../pages/MediaPage/actions.js';

import { CircleIconButton } from './CircleIconButton';
import { MaterialIcon } from './MaterialIcon';

import { formatNumber } from '../../functions';

export function MediaDislikeIcon(props){

	const counterRef = useRef(null);

	const [ dislikedMedia, setDislikedMedia ] = useState( MediaPageStore.get('user-disliked-media') );
	const [ dislikesCounter, setDislikesCounter ] = useState( formatNumber( MediaPageStore.get('media-dislikes'), false ) );

	function updateStateValues(){
		setDislikedMedia( MediaPageStore.get('user-disliked-media') );
		setDislikesCounter( formatNumber( MediaPageStore.get('media-dislikes'), false ) );
	}

	function onCompleteMediaDislike(){
		updateStateValues();
		PageActions.addNotification( TextsContext._currentValue.messages.addToDisliked, 'mediaDislike' );
	}

	function onCompleteMediaDislikeCancel(){
		updateStateValues();
		PageActions.addNotification( TextsContext._currentValue.messages.removeFromDisliked, 'cancelMediaDislike' );
	}

	function onFailMediaDislikeRequest(){
		PageActions.addNotification("Action failed", 'mediaDislikeRequestFail');
	}

	function toggleDislike(ev){
		ev.preventDefault();
		ev.stopPropagation();
		MediaPageActions[ dislikedMedia ? 'undislikeMedia' : 'dislikeMedia' ]();
	}

	useEffect( () => {
		MediaPageStore.on( "disliked_media", onCompleteMediaDislike );
        MediaPageStore.on( "undisliked_media", onCompleteMediaDislikeCancel );
        MediaPageStore.on( "disliked_media_failed_request", onFailMediaDislikeRequest );
		return () => {
			MediaPageStore.removeListener( "disliked_media", onCompleteMediaDislike );
	        MediaPageStore.removeListener( "undisliked_media", onCompleteMediaDislikeCancel );
	        MediaPageStore.removeListener( "disliked_media_failed_request", onFailMediaDislikeRequest );
		};
	}, []);

	return ( <div className="dislike">
				<button onClick={ toggleDislike }>
					<CircleIconButton type="span"><MaterialIcon type="thumb_down" /></CircleIconButton>
					<span className="dislikes-counter">{ dislikesCounter }</span>
				</button>
		   </div> );
}