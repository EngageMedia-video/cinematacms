import React from 'react';

export function RippleDecoration() {
	return (
		<div className="app-layout__ripple">
			<img
				className="app-layout__ripple-image app-layout__ripple-image--light-theme"
				src="/static/images/img_ripple_light.webp"
				alt=""
				aria-hidden="true"
			/>
			<img
				className="app-layout__ripple-image app-layout__ripple-image--dark-theme"
				src="/static/images/img_ripple_dark.webp"
				alt=""
				aria-hidden="true"
			/>
		</div>
	);
}
