import React from 'react';
import PropTypes from 'prop-types';

import { CircleIconButton } from '../../../static/js/components/-NEW-/CircleIconButton';
import { MaterialIcon } from '../../../static/js/components/-NEW-/MaterialIcon';

export function OtherMediaDownloadLink(props) {
	return (
		<div className="download hidden-only-in-small">
			<a href={props.link} target="_blank" download={props.title} title="Download">
				<CircleIconButton type="span">
					<MaterialIcon type="arrow_downward" />
				</CircleIconButton>
				<span>DOWNLOAD</span>
			</a>
		</div>
	);
}

OtherMediaDownloadLink.propTypes = {
	link: PropTypes.string.isRequired,
	title: PropTypes.string.isRequired,
};
