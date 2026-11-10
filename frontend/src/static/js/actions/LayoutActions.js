import Dispatcher from '../classes_instances/dispatcher.js';

export function toggleSidebar() {
	Dispatcher.dispatch({
		type: 'TOGGLE_SIDEBAR',
	});
}
