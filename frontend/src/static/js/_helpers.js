import ComponentRenderer from './classes_instances/components-renderer';

import { PageHeader } from './components/-NEW-/PageHeader';
import { PageSidebar } from './components/-NEW-/PageSidebar';
import { AppLayout } from '../../features/layout';

function shouldUseModernShell() {
	return document.body?.dataset.uiVariant === 'revamp' && null !== document.getElementById('app-root');
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

	ComponentRenderer.display(document.getElementById('app-header'), PageHeader, {}, 'app-header');
	ComponentRenderer.display(document.getElementById('app-sidebar'), PageSidebar, {}, 'app-sidebar');

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
