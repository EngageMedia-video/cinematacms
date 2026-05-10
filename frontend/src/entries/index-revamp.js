import { renderPage } from '../static/js/_helpers.js';
import { HomePage } from '../features/home';
import homeQueryClient from '../features/home/queryClient';
import { readInitialDataFromDom } from '../features/home/initialData';

const initialData = readInitialDataFromDom();
if (initialData) {
	homeQueryClient.setQueryData(['home', 'featured'], initialData.featured);
	homeQueryClient.setQueryData(['home', 'recommended'], initialData.recommended);
}

renderPage('page-home', HomePage);
