import Dispatcher from '../../../classes_instances/dispatcher.js';

export function requestPredictions(query) {
	Dispatcher.dispatch({
		type: 'REQUEST_PREDICTIONS',
		query,
	});
}
