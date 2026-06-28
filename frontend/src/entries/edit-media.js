import { renderPage } from '../static/js/_helpers.js';
import { EditMediaPage } from '../features/edit-media';

const isRevamp = document.body?.dataset.uiVariant === 'revamp' && document.getElementById('app-root') !== null;

if (isRevamp) {
	renderPage('page-edit-media', EditMediaPage);
} else {
	renderPage('page-edit-media');
}
