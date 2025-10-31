import React from 'react';
import PropTypes from 'prop-types';

import stylesheet from "../styles/MediaListWrapper.scss";

export function MediaMultiListWrapper(props){
	return (<div className={ ( void 0 === props.className || null === props.className ? '' : props.className + ' ' ) + 'media-list-wrapper full-bleed' } style={ props.style }>
				{ props.children || null }
			</div>);
}

MediaMultiListWrapper.propTypes = {
	style: PropTypes.object,
	className: PropTypes.string,
};
