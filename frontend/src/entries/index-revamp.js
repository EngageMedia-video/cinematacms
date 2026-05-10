import { renderPage } from '../static/js/_helpers.js';
import { HomePage } from '../features/home';
import homeQueryClient, { HOME_QUERY_KEYS } from '../features/home/queryClient';
import { readInitialDataFromDom } from '../features/home/initialData';

const initialData = readInitialDataFromDom();
if (initialData) {
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.featured, initialData.featured);
	homeQueryClient.setQueryData(HOME_QUERY_KEYS.recommended, initialData.recommended);
}

renderPage('page-home', HomePage);
