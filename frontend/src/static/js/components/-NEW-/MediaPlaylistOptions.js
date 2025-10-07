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
		const props_media_id = props.media_id;
		const props_playlist_id = props.playlist_id;
		setTimeout(function(){	// @note: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
			PageActions.addNotification( "Media removed from playlist", 'mediaPlaylistRemove');
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
