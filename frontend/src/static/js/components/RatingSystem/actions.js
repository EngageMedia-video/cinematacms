import Dispatcher from '../../classes_instances/dispatcher.js';

export function init(media_id) {
	Dispatcher.dispatch({
		type: 'INIT',
		media_id,
	});
}

export function extendRateCategories() {
	Dispatcher.dispatch({
		type: 'EXTEND_RATE_CATEGORIES',
	});
}

export function rateSumbit(category_id, score) {
	Dispatcher.dispatch({
		type: 'RATE_SUBMIT',
		id: category_id,
		score,
	});
}
