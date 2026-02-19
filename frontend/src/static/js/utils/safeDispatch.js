import Dispatcher from '../classes_instances/dispatcher';

const queue = [];
let draining = false;

export function safeDispatch(action) {
	queue.push(action);
	if (!draining) {
		draining = true;
		setTimeout(() => {
			while (queue.length) Dispatcher.dispatch(queue.shift());
			draining = false;
		}, 0);
	}
}
