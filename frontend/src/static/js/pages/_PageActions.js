import Dispatcher from '../classes_instances/dispatcher.js';

export function initPage(page) {
    Dispatcher.dispatch({
        type: 'INIT_PAGE',
        page
    });
};

export function toggleMediaAutoPlay(){
    Dispatcher.dispatch({
        type: 'TOGGLE_AUTO_PLAY',
    });
};

export function addNotification(notification, notificationId) {
    setTimeout(() => Dispatcher.dispatch({
        type: 'ADD_NOTIFICATION',
        notification,
        notificationId,
    }), 0);
};