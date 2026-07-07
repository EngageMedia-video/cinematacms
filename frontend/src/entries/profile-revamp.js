import { renderPage } from '../static/js/_helpers.js';
import { createElement } from 'react';
import { ProfilePage } from '../features/profile';
import { readInitialDataFromDom } from '../features/profile/initialData';
import profileQueryClient, { PROFILE_QUERY_KEYS } from '../features/profile/queryClient';

const author = readInitialDataFromDom();
const activeTab = author?.active_tab || 'about';

if (author?.username) {
	profileQueryClient.setQueryData(PROFILE_QUERY_KEYS.author(author.username), author);
}

function ProfileEntry() {
	return author ? createElement(ProfilePage, { author, activeTab }) : null;
}

renderPage('page-profile', ProfileEntry);
