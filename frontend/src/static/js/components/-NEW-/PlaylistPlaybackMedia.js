import React from 'react';
import PropTypes from 'prop-types';

import { PositiveIntegerOrZero } from '../../functions/propTypeFilters';

import { ItemList } from './ItemList';

export function PlaylistPlaybackMedia(props){
	props = { playlistActiveItem: 1, ...props };

	return ( <ItemList
				className={ 'items-list-hor' }
				pageItems={ 9999 }
				maxItems={ 9999 }
				items={ props.items }
				hideDate={ true }
				hideViews={ true }
				hidePlaylistOrderNumber={ false }
				horizontalItemsOrientation={ true }
				inPlaylistView={ true }
				singleLinkContent={ true }
				playlistActiveItem={ props.playlistActiveItem }
			/>);
}

PlaylistPlaybackMedia.propTypes = {
	items: PropTypes.array.isRequired,
	playlistActiveItem: PositiveIntegerOrZero,
};

