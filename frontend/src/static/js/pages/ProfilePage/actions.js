import Dispatcher from '../../classes_instances/dispatcher.js';

export function load_author_data() {
	Dispatcher.dispatch({
		type: 'LOAD_AUTHOR_DATA',
	});
}

export function remove_profile() {
	Dispatcher.dispatch({
		type: 'REMOVE_PROFILE',
	});
}
