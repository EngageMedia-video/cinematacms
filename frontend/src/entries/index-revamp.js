import { renderPage } from '../static/js/_helpers.js';
import { HomePage } from '../features/home';
import homeQueryClient from '../features/home/queryClient';
import { readInitialDataFromDom, seedHomeInitialData } from '../features/home/initialData';

const initialData = readInitialDataFromDom();
seedHomeInitialData(homeQueryClient, initialData);

renderPage('page-home', HomePage);
