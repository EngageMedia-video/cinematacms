import { Dispatcher } from 'flux';

export default new Dispatcher();

if (import.meta.hot) {
	import.meta.hot.decline();
}
