import { renderPage } from '../static/js/_helpers.js';

import('../features/edit-media').then(({ EditMediaPage }) => {
	renderPage('page-edit-media', EditMediaPage);
});
