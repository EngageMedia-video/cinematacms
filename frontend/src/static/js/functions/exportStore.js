import dispatcher from '../classes_instances/dispatcher.js';
export default function(store, handler){
	dispatcher.register(store[handler].bind(store));
    return store;
}