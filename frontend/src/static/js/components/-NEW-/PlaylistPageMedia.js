import React from 'react';
import PropTypes from 'prop-types';

import { ItemList } from './ItemList';

export function PlaylistPageMedia(props){
	props = { hidePlaylistOptions: true, ...props };

	return ( <ItemList
				items={ props.media }
				playlistId={ props.playlistId }
				hidePlaylistOptions={ props.hidePlaylistOptions }
				singleLinkContent={ true }
				hideDate={ true }
				hideViews={ true }
				hidePlaylistOrderNumber={ false }
				horizontalItemsOrientation={ true }
				itemsCountCallback={ props.itemsCountCallback }
				itemsLoadCallback={ props.itemsLoadCallback }
			 	pageItems={ 99999 }
			 	inPlaylistPage={true} /> );
}

PlaylistPageMedia.propTypes = {
	media: PropTypes.array.isRequired,
	playlistId: PropTypes.string.isRequired,
	itemsCountCallback: PropTypes.func,
	itemsLoadCallback: PropTypes.func,
	hidePlaylistOptions: PropTypes.bool,
};

