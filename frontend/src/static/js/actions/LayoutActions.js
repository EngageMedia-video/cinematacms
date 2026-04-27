import Dispatcher from '../classes_instances/dispatcher.js';

export function toggleSidebar() {
	Dispatcher.dispatch({
		type: 'TOGGLE_SIDEBAR',
	});
}

export function changeMobileSearchVisibility(visible) {
	Dispatcher.dispatch({
		type: 'CHANGE_MOBILE_SEARCH_VISIBILITY',
		visible,
	});
}
