import React from 'react';

export function CannotUploadMessage({ config }) {
	return (
		<React.Fragment>
			{config.canUploadMessage || null}
			<br />
			<a href="/contact">Contact</a> the admin owners for more information.
		</React.Fragment>
	);
}
