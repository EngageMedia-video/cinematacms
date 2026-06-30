import { renderPage } from '../static/js/_helpers.js';

const isRevamp = document.body?.dataset.uiVariant === 'revamp' && document.getElementById('app-root') !== null;

if (isRevamp) {
	import('../features/edit-media').then(({ EditMediaPage }) => {
		renderPage('page-edit-media', EditMediaPage);
	});
} else {
	renderPage('page-edit-media');
}
