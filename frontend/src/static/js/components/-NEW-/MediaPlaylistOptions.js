import React, { useState } from 'react';

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

function mediaPlaylistPopupPages(proceedRemoval){

	const settingOptionsList = {
		deleteMedia: {
			itemType: "open-subpage",
			text: "Remove from playlist",
			icon: "delete",
			buttonAttr: {
				className: "delete-media-from-playlist",
				onClick: proceedRemoval,
			},
		}
	};

	const pages = {
		main: <PopupMain>
				<NavigationMenuList items={ [ settingOptionsList.deleteMedia ] } />
			</PopupMain>,
	};

	return pages;
}

export function MediaPlaylistOptions(props){

	const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();

	const [ popupPages ] = useState( mediaPlaylistPopupPages(proceedRemoval) );

	function mediaPlaylistRemovalCompleted(){
		popupContentRef.current.tryToHide();
		PageActions.addNotification( "Media removed from playlist", 'mediaPlaylistRemove');
		PlaylistPageActions.removedMediaFromPlaylist( props.media_id, props.playlist_id );
	}

	function mediaPlaylistRemovalFailed(){
		popupContentRef.current.tryToHide();
		PageActions.addNotification( "Media removal from playlist failed", 'mediaPlaylistRemoveFail');
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

	return (<div className="item-playlist-options-wrap item-playlist-options-main">

				<PopupTrigger contentRef={ popupContentRef }>
					<CircleIconButton><MaterialIcon type="more_vert" /></CircleIconButton>
				</PopupTrigger>

				<PopupContent contentRef={ popupContentRef }>
					<NavigationContentApp
						initPage="main"
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
