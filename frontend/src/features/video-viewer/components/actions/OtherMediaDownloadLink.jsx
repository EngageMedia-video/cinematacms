import React from 'react';
import PropTypes from 'prop-types';

import { CircleIconButton } from '../../../../static/js/components/-NEW-/CircleIconButton';
import { MaterialIcon } from '../../../../static/js/components/-NEW-/MaterialIcon';
import { originalDownloadFilename } from './originalDownloadFilename';

export function OtherMediaDownloadLink({ link, title }) {
	return (
		<div className="download hidden-only-in-small">
			<a href={link} target="_blank" download={originalDownloadFilename(title, link)} title="Download">
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
