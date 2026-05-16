import React from 'react';

import PageStore from '../../../../../static/js/pages/_PageStore.js';

export function SidebarBelowNavigationMenu({ className = '' }) {
	const content = PageStore.get('config-contents').sidebar.belowNavMenuNew;

	return content ? <div className={className} dangerouslySetInnerHTML={{ __html: content }}></div> : null;
}
