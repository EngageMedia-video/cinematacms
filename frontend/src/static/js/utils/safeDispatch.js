import Dispatcher from '../classes_instances/dispatcher';

const queue = [];
let draining = false;

export function safeDispatch(action) {
	queue.push(action);
	if (!draining) {
		draining = true;
		setTimeout(() => {
			try {
				while (queue.length) {
					try {
						Dispatcher.dispatch(queue.shift());
					} catch (e) {
						console.error('[safeDispatch] Action dispatch failed:', e);
					}
				}
			} finally {
				draining = false;
			}
		}, 0);
	}
}
