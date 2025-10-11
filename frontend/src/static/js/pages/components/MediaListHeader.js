import React from 'react';
import PropTypes from 'prop-types';

export function MediaListHeader(props){
	return (<><div className={ ( void 0 === props.className || null === props.className ? '' : props.className + ' ' ) + 'hw-category' } style={ props.style }>
				<h2 className="hw-category-title">{ props.title }</h2>
				{ void 0 === props.viewAllLink || null === props.viewAllLink ? null : <a href={ props.viewAllLink } title={ props.viewAllText || props.viewAllLink } className="hw-category-link">{ props.viewAllText || props.viewAllLink }</a> }
			</div>
			{ props.desc && <div className="hw-category-description" dangerouslySetInnerHTML={{ __html: props.desc }}></div> }
			</>);
}

MediaListHeader.propTypes = {
	style: PropTypes.object,
	className: PropTypes.string,
	title: PropTypes.string.isRequired,
	viewAllLink: PropTypes.string,
	viewAllText: PropTypes.string,
};

MediaListHeader.defaultProps = {
	viewAllText: 'VIEW ALL',
};

