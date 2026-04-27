import React from 'react';

import PageStore from '../../pages/_PageStore.js';

export function SidebarBelowNavigationMenu() {
	const content = PageStore.get('config-contents').sidebar.belowNavMenu;

	return content ? (
		<div className="page-sidebar-under-nav-menus" dangerouslySetInnerHTML={{ __html: content }}></div>
	) : null;
}
