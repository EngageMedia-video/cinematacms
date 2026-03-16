import React, { useEffect, useRef } from 'react';

import * as LayoutActions from '../../actions/LayoutActions.js';

import '../styles/PageSidebarContentOverlay.scss';

export function PageSidebarContentOverlay() {
	const containerRef = useRef(null);

	function onClick(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		LayoutActions.toggleSidebar();
	}

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		el.addEventListener('click', onClick);
		return () => el.removeEventListener('click', onClick);
	}, []);

	return <div ref={containerRef} className="page-sidebar-content-overlay"></div>;
}
