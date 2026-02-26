import React from 'react';
import PropTypes from 'prop-types';
export function MediaListHeader(props){
	props = { viewAllText: 'VIEW ALL', ...props };
	return (<><div className={ ( void 0 === props.className || null === props.className ? '' : props.className + ' ' ) + 'hw-category' } style={ props.style }>
				{props.title && (
					props.title === "Featured by Curators" ? (
						<h1 className="hw-category-title">{props.title}</h1>
					) : (
						<h2 className="hw-category-title hw-category-title-h2">{props.title}</h2>
					)
					)}
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
