import ComponentRenderer from './classes_instances/components-renderer';

import { PageHeader } from './components/-NEW-/PageHeader';
import { PageSidebar } from './components/-NEW-/PageSidebar';

export function renderPage( idSelector, PageComponent ){

	ComponentRenderer.display( document.getElementById('app-header'), PageHeader, {}, 'app-header' );
	ComponentRenderer.display( document.getElementById('app-sidebar'), PageSidebar, {}, 'app-sidebar' );

	if( idSelector !== undefined && PageComponent !== undefined ){
		
		const elem = document.getElementById( idSelector );
		
		if( null !== elem ){
			ComponentRenderer.display( elem, PageComponent, {}, idSelector );
		}
	}
}

export function renderEmbedPage( idSelector, PageComponent ){

	if( idSelector !== undefined && PageComponent !== undefined ){
		
		const elem = document.getElementById( idSelector );
		
		if( null !== elem ){
			ComponentRenderer.display( elem, PageComponent, {}, idSelector );
		}
	}
}