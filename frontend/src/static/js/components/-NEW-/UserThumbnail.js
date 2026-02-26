import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import UserContext from '../../contexts/UserContext';

import { CircleIconButton } from './CircleIconButton';
import { MaterialIcon } from './MaterialIcon';

import PageStore from '../../pages/_PageStore.js';
import * as PageActions from '../../pages/_PageActions.js';

import "../styles/UserThumbnail.scss";

export function UserThumbnail(props){
	props = { isButton: false, size: 'medium', ...props };

    const user = useContext( UserContext );

	const attr = {
		'aria-label': 'Account profile photo that opens list of options and settings pages links',
		className: "thumbnail",
	};

	if( props.isButton ){

		if ( void 0 !== props.onClick ){
			attr.onClick = props.onClick;
		}
	}
	else{
		attr.type = 'span';
	}

	switch(props.size){
		case 'small':
		case 'large':
			attr.className += ' ' + props.size + '-thumb';
			break;
	}

	return ( <CircleIconButton { ...attr }>
				{ user.thumbnail ? <img src={ user.thumbnail } alt='' /> : <MaterialIcon type='person' /> }
			</CircleIconButton> );
}

UserThumbnail.propTypes = {
	isButton: PropTypes.bool,
	size: PropTypes.oneOf( ['small', 'medium', 'large'] ),
	onClick: PropTypes.func,
};

