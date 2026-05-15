import { renderPage } from '../static/js/_helpers.js';
import { HomePage } from '../features/home';
import homeQueryClient, { HOME_QUERY_KEYS } from '../features/home/queryClient';
import { readInitialDataFromDom } from '../features/home/initialData';

function isMediaListPayload(value) {
	return Array.isArray(value) || Array.isArray(value?.results);
}

const initialData = readInitialDataFromDom();
if (isMediaListPayload(initialData?.featured)) {
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, initialData.featured);
}
if (isMediaListPayload(initialData?.recommended)) {
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.recommended, initialData.recommended);
}

renderPage('page-home', HomePage);
