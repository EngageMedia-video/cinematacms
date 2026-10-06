import React from 'react';
import PropTypes from 'prop-types';

import { MediaListHeader } from './MediaListHeader';

export function MediaListRow(props) {
	return (
		<div
			data-analytics-placement={props.analyticsPlacement}
			className={
				(void 0 === props.className || null === props.className ? '' : props.className + ' ') + 'media-list-row'
			}
			style={props.style}
		>
			{void 0 === props.title || null === props.title ? null : (
				<MediaListHeader
					title={props.title}
					viewAllLink={props.viewAllLink}
					viewAllText={props.viewAllText}
					desc={props.desc}
				/>
			)}
			{props.children || null}
		</div>
	);
}

MediaListRow.propTypes = {
	analyticsPlacement: PropTypes.string,
	style: PropTypes.object,
	className: PropTypes.string,
	title: PropTypes.string,
	viewAllLink: PropTypes.string,
	viewAllText: PropTypes.string,
	children: PropTypes.node,
};
