import { renderPage } from '../static/js/_helpers.js';
import { AddMediaPage as AddMediaPageRevamp } from '../features/add-media';
import { AddMediaPage as AddMediaPageLegacy } from '../static/js/pages/AddMediaPage';

const isRevamp = document.body?.dataset.uiVariant === 'revamp' && document.getElementById('app-root') !== null;
const PageComponent = isRevamp ? AddMediaPageRevamp : AddMediaPageLegacy;

renderPage('page-add-media', PageComponent);
