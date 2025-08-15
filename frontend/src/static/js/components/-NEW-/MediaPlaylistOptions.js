import React, { useRef, useState, useEffect } from 'react';

import PropTypes from 'prop-types';

import { usePopup } from './hooks/usePopup';

import { PopupMain } from './Popup';
import { MaterialIcon } from './MaterialIcon';
import { CircleIconButton } from './CircleIconButton';
import { NavigationMenuList } from './NavigationMenuList';
import { NavigationContentApp } from './NavigationContentApp';

import PageStore from '../../pages/_PageStore';
import * as PageActions from '../../pages/_PageActions.js';
import * as PlaylistPageActions from '../../pages/PlaylistPage/actions.js';

import { putRequest, getCSRFToken } from '../../functions';

function mediaPlaylistPopupPages(proceedRemoval, cancelRemoval){

	const settingOptionsList = {
		deleteMedia: {
			itemType: "open-subpage",
			text: "Remove from playlist",
			icon: "delete",
			buttonAttr: {
				className: 'change-page',
				'data-page-id': 'proceedMediaPlaylistRemoval',
			},
		}
	};

	const pages = {
		main: <PopupMain>
				<NavigationMenuList items={ [ settingOptionsList.deleteMedia ] } />
			</PopupMain>,
		proceedMediaPlaylistRemoval: <PopupMain>
										<div className="popup-message">
											<span className="popup-message-title">Media playlist removal</span>
											<span className="popup-message-main">You're willing to remove media from playlist permanently?</span>
										</div>
								  		<hr/>
										<span className="popup-message-bottom">
											<button className="button-link cancel-playlist-removal" onClick={ cancelRemoval }>CANCEL</button>
											<button className="button-link proceed-playlist-removal" onClick={ proceedRemoval }>PROCEED</button>
										</span>
								  	</PopupMain>,
	};

	return pages;
}

export function MediaPlaylistOptions(props){

	const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();
	
	const [ popupCurrentPage, setPopupCurrentPage ] = useState( 'main' );

	const [ popupPages ] = useState( mediaPlaylistPopupPages(proceedRemoval, cancelRemoval) );

	function mediaPlaylistRemovalCompleted(){
		popupContentRef.current.tryToHide();
		const props_media_id = props.media_id;
		const props_playlist_id = props.playlist_id;
		setTimeout(function(){	// @note: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
			PageActions.addNotification( "Video removed from playlist", 'mediaPlaylistRemove');
			PlaylistPageActions.removedMediaFromPlaylist( props_media_id, props_playlist_id );
		}, 100);		
		// console.info('Media "' + this.props.media_id + '" removed from playlist "' + this.props.playlist_id + '"');
	}

	function mediaPlaylistRemovalFailed(){
		popupContentRef.current.tryToHide();
		setTimeout(function(){	// @note: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
			PageActions.addNotification( "Media removal from playlist failed", 'mediaPlaylistRemoveFail');
		}, 100);
		// console.info('Media "' + this.props.media_id + '" removal from playlist "' + this.props.playlist_id + '" failed');
	}

	function proceedRemoval(){
        putRequest(
            PageStore.get('api-playlists') + '/' + props.playlist_id,
            {
                type: 'remove',
                media_friendly_token: props.media_id,
            },
            {
                headers: {
                    'X-CSRFToken': getCSRFToken(),
                }
            },
            false,
            mediaPlaylistRemovalCompleted,
            mediaPlaylistRemovalFailed
        );
	}

	function cancelRemoval(){
		popupContentRef.current.toggle();
	}

	function onPopupPageChange(newPage){ setPopupCurrentPage(newPage); }
	function onPopupHide(){ setPopupCurrentPage('main'); }

	return (<div className={ "item-playlist-options-wrap" + ( "main" === popupCurrentPage ? " item-playlist-options-main" : "") }>

				<PopupTrigger contentRef={ popupContentRef }>
					<CircleIconButton><MaterialIcon type="more_vert" /></CircleIconButton>
				</PopupTrigger>

				<PopupContent contentRef={ popupContentRef } hideCallback={ onPopupHide }>
					<NavigationContentApp
						pageChangeCallback={ onPopupPageChange }
						initPage={ popupCurrentPage }
						focusFirstItemOnPageChange={ false }
						pages={ popupPages }
						pageChangeSelector={ '.change-page' }
						pageIdSelectorAttr={ 'data-page-id' }
					/>
				</PopupContent>
					
			</div>);
}

MediaPlaylistOptions.propTypes = {};
MediaPlaylistOptions.propTypes.media_id = PropTypes.string.isRequired;
MediaPlaylistOptions.propTypes.playlist_id = PropTypes.string.isRequired;
