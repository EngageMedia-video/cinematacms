import Dispatcher from '../classes_instances/dispatcher.js';

export function toggleMode() {
	Dispatcher.dispatch({
		type: 'TOGGLE_MODE',
	});
}
