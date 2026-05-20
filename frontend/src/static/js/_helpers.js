import ComponentRenderer from './classes_instances/components-renderer';

import { AppLayout, Sidebar } from '../../features/layout';
import { LegacyTopbarMount } from '../../features/layout/topbar/LegacyTopbarMount';

function shouldUseModernShell() {
	return document.body?.dataset.uiVariant === 'revamp' && document.getElementById('app-root') !== null;
}

export function renderPage(idSelector, PageComponent) {
	if (shouldUseModernShell()) {
		ComponentRenderer.display(
			document.getElementById('app-root'),
			AppLayout,
			{ pageSlotId: idSelector, ContentComponent: PageComponent },
			'app-root'
		);

		return;
	}

	ComponentRenderer.display(document.getElementById('app-header'), LegacyTopbarMount, {}, 'app-header');
	ComponentRenderer.display(document.getElementById('app-sidebar'), Sidebar, { id: null }, 'app-sidebar');

	if (idSelector !== undefined && PageComponent !== undefined) {
		const elem = document.getElementById(idSelector);

		if (null !== elem) {
			ComponentRenderer.display(elem, PageComponent, {}, idSelector);
		}
	}
}

export function renderEmbedPage(idSelector, PageComponent) {
	if (idSelector !== undefined && PageComponent !== undefined) {
		const elem = document.getElementById(idSelector);

		if (null !== elem) {
			ComponentRenderer.display(elem, PageComponent, {}, idSelector);
		}
	}
}
