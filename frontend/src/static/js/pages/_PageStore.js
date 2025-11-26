import React from 'react';
import EventEmitter from 'events';

import BrowserCache from '../classes/BrowserCache.js';

import { exportStore } from '../functions';

import { addClassname, removeClassname } from '../functions/dom.js';

import { config as mediaCmsConfig } from '../mediacms/config.js';

/*import * as MediaCMSLib from '../../../../lib/dist/mediacms-frontend-lib.js';

const MediaCMSModels = MediaCMSLib.core.entities;*/

/* ################################################## */
/* ################################################## */
/* ################################################## */
/* ################################################## */
/* ################################################## */

function BrowserEvents() {

    const callbacks = {
        document: {
            visibility: [],
        },
        window: {
            resize: [],
            scroll: [],
        },
    };

    function onDocumentVisibilityChange() {
        callbacks.document.visibility.forEach(fn => fn());
    }

    function onWindowResize() {
        callbacks.window.resize.forEach(fn => fn());
    }

    function onWindowScroll() {
        callbacks.window.scroll.forEach(fn => fn());
    }

    function windowEvents(resizeCallback, scrollCallback) {

        if ('function' === typeof resizeCallback) {
            callbacks.window.resize.push(resizeCallback);
        }

        if ('function' === typeof scrollCallback) {
            callbacks.window.scroll.push(scrollCallback);
        }
    }

    function documentEvents(visibilityChangeCallback) {

        if ('function' === typeof visibilityChangeCallback) {
            callbacks.document.visibility.push(visibilityChangeCallback);
        }
    }

    document.addEventListener('visibilitychange', onDocumentVisibilityChange);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('scroll', onWindowScroll);

    return {
        doc: documentEvents,
        win: windowEvents,
    };
}

/*
 * Generate a unique identifier
 */
function uniqid() {
    return crypto.randomUUID();
}

function Notifications(initialNotifications) {

    let stack = [];

    function push(msg) {
        if ('string' === typeof msg) {
            stack.push([uniqid(), msg]);
        }
    }

    /*function unshift( msg ){
        if( 'string' === typeof msg ){
            stack.unshift( [ uniqid(), msg ] );
        }
    }

    function pop(){
        return stack.pop();
    }

    function shift(){
        return stack.shift();
    }*/

    function messages() {
        return [...stack];
    }

    function clear() {
        stack = [];
    }

    function size() {
        return stack.length;
    }

    initialNotifications.forEach(push);

    return {
        size,
        push,
        clear,
        messages,
    };
}

/* ################################################## */
/* ################################################## */
/* ################################################## */
/* ################################################## */
/* ################################################## */

let browserCache;

let page_config = null;
let mediacms_config = null;

const mediacms_member_page_link = k => mediacms_config.member.pages[k] || '#';

const mediacms_api_endpoint_url = k => mediacms_config.api[k] || null;

class PageStore extends EventEmitter {

    constructor(page) {

        super();

        // TODO: Remove setMaxListeners once all 13 components migrate to LayoutContext
        // Components still using PageStore.on('window_resize') should migrate to useWindowResize hook
        this.setMaxListeners(50);

        mediacms_config = mediaCmsConfig(window.MediaCMS);

        browserCache = new BrowserCache(mediacms_config.site.id, 86400);  // Keep cache data "fresh" for one day.

        page_config = {
            mediaAutoPlay: browserCache.get('media-auto-play'),
        };

        page_config.mediaAutoPlay = null !== page_config.mediaAutoPlay ? page_config.mediaAutoPlay : true;

        /* ################################################## */
        /* ################################################## */

        /*this._SITE = new MediaCMSModels.Site( mediacms_config.site.id, mediacms_config.site.title, mediacms_config.site.url, mediacms_config.site.api );
        this._PAGE = null;
        this._USER = new MediaCMSModels.User( mediacms_config.member.username, mediacms_config.member.name, mediacms_config.member.thumbnail );

        this._USER.setRoles({ ...mediacms_config.member.is });
        this._USER.setAbilities({ ...mediacms_config.member.can });*/

        /* ################################################## */
        /* ################################################## */

        this.browserEvents = BrowserEvents();
        this.browserEvents.doc(this.onDocumentVisibilityChange.bind(this));
        this.browserEvents.win(this.onWindowResize.bind(this), this.onWindowScroll.bind(this));

        this.notifications = Notifications(void 0 !== window.MediaCMS && void 0 !== window.MediaCMS.notifications ? window.MediaCMS.notifications : []);

        // Custom listeners for window resize to avoid EventEmitter MaxListenersExceededWarning
        this.resizeListeners = [];
        this.resizeTimeout = null;
    }

    addWindowResizeListener(callback) {
        if ('function' === typeof callback) {
            this.resizeListeners.push(callback);
        }
    }

    removeWindowResizeListener(callback) {
        this.resizeListeners = this.resizeListeners.filter(cb => cb !== callback);
    }

    onDocumentVisibilityChange() {
        this.emit('document_visibility_change');
    }

    onWindowScroll() {
        this.emit('window_scroll');
    }

    onWindowResize() {
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        this.resizeTimeout = setTimeout(() => {
            this.emit('window_resize');
            this.resizeListeners.forEach(cb => cb());
        }, 200);
    }

    initPage(page) {

        page_config.currentPage = page;

        /* ################################################## */
        /* ################################################## */

        /*this._PAGE = new MediaCMSModels.Page( page );

        // console.log( mediacms_config );
        // console.log( mediacms_config.member );
        // console.log( MediaCMSLib );
        // console.log( MediaCMSModels );

        console.log( this._SITE );
        console.log( this._PAGE );
        console.log( this._USER );*/

        /* ################################################## */
        /* ################################################## */
    }

    get(type) {

        let r;

        switch (type) {
            case 'browser-cache':
                r = browserCache;
                break;
            case 'media-auto-play':
                r = page_config.mediaAutoPlay;
                break;
            case 'config-contents':
                r = mediacms_config.contents;
                break;
            case 'config-enabled':
                r = mediacms_config.enabled;
                break;
            case 'config-media-item':
                r = mediacms_config.media.item;
                break;
            case 'config-options':
                r = mediacms_config.options;
                break;
            case 'config-site':
                r = mediacms_config.site;
                break;
            case 'api-playlists':
                r = mediacms_api_endpoint_url(type.split('-')[1]);
                break;
            case 'window-inner-width':
                r = window.innerWidth;
                break;
            case 'notifications-size':
                r = this.notifications.size();
                break;
            case 'notifications':
                r = this.notifications.messages();
                this.notifications.clear();
                break;
            case 'current-page':
                r = page_config.currentPage;
                break;
        }
        return r;
    }

    actions_handler(action) {
        switch (action.type) {
            case 'INIT_PAGE':
                this.initPage(action.page);
                this.emit('page_init');
                break;
            case 'TOGGLE_AUTO_PLAY':
                page_config.mediaAutoPlay = !page_config.mediaAutoPlay;
                browserCache.set('media-auto-play', page_config.mediaAutoPlay);
                this.emit('switched_media_auto_play');
                break;
            case 'ADD_NOTIFICATION':
                this.notifications.push(action.notification);
                this.emit('added_notification');
                break;
        }
    }
}

export default exportStore(new PageStore, 'actions_handler');