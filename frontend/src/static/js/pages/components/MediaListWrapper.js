import React from 'react';
import PropTypes from 'prop-types';

import { MediaListRow } from './MediaListRow';

import "../styles/MediaListWrapper.scss";

export function MediaListWrapper(props){
	return ( <div className={ ( void 0 === props.className || null === props.className ? '' : props.className + ' ' ) + 'media-list-wrapper' } style={ props.style }>
				<MediaListRow title={ props.title } viewAllLink={ props.viewAllLink } viewAllText={ props.viewAllText }>
					{ props.children || null }
				</MediaListRow>
			</div> );
}

MediaListWrapper.propTypes = {
	style: PropTypes.object,
	className: PropTypes.string,
};
