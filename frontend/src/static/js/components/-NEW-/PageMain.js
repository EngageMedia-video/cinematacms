import React from 'react';

import LayoutStore from '../../stores/LayoutStore.js';

import { PageSidebarContentOverlay } from './PageSidebarContentOverlay';

export default function PageMain(props) {
	return (
		<div className="page-main">
			{props.children || null}
			{LayoutStore.get('enabled-sidebar') ? <PageSidebarContentOverlay /> : null}
		</div>
	);
}
