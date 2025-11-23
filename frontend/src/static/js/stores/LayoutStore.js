import React from 'react';
import EventEmitter from 'events';
import BrowserCache from '../classes/BrowserCache.js';
import { exportStore } from '../functions';
import { addClassname, removeClassname } from '../functions/dom.js';
import { config as mediaCmsConfig } from '../mediacms/config.js';

import PageStore from '../pages/_PageStore';

let slidingSidebarTimeout;

function onSidebarVisibilityChange( visibleSidebar ){

    clearTimeout( slidingSidebarTimeout );

    addClassname( document.body, 'sliding-sidebar');

    slidingSidebarTimeout = setTimeout( function(){

        if( 'media' === PageStore.get('current-page') ){

            if( visibleSidebar ){
                addClassname( document.body, 'overflow-hidden' );
            }
            else{
                removeClassname( document.body, 'overflow-hidden' );
            }
        }
        else{

            if( ! visibleSidebar || 767 < window.innerWidth ){
                removeClassname( document.body, 'overflow-hidden' );
            }
            else{
                addClassname( document.body, 'overflow-hidden' );
            }
        }

        if( visibleSidebar ){
            addClassname( document.body, 'visible-sidebar');
        }
        else{
            removeClassname( document.body, 'visible-sidebar');
        }

        slidingSidebarTimeout = setTimeout(function(){
            slidingSidebarTimeout = null;
            removeClassname( document.body, 'sliding-sidebar');
        }, 220);

    }, 20);
}

class LayoutStore extends EventEmitter{

    constructor() {

        super();

        const config = mediaCmsConfig( window.MediaCMS );

        // Keep cache data "fresh" for one day.
        this.cache = new BrowserCache( 'MediaCMS[' + config.site.id + '][layout]', 86400 );

        this.state = {
            enabledSidebar: document.getElementById("app-sidebar") || document.querySelector(".page-sidebar") ? true : false,
            visibleSidebar: this.cache.get('visible-sidebar'),
            visibleMobileSearch: false,
        };

        if( 'media' === PageStore.get('current-page') ){
            this.state.visibleSidebar = false;
        }
        else{
            this.state.visibleSidebar = 1023 < window.innerWidth && ( null === this.state.visibleSidebar || this.state.visibleSidebar );
        }

        if( this.state.visibleSidebar ){
            addClassname( document.body, 'visible-sidebar');
        }
        else{
            removeClassname( document.body, 'visible-sidebar');
        }

        PageStore.once( 'page_init', (()=>{
            if( 'media' === PageStore.get('current-page') ){
                this.state.visibleSidebar = false;
                removeClassname( document.body, 'visible-sidebar');
            }
        }).bind(this));
    }

    get(type){
        switch(type){
            case 'enabled-sidebar':
                return this.state.enabledSidebar;
            case 'visible-sidebar':
                return this.state.visibleSidebar;
            case 'visible-mobile-search':
                return this.state.visibleMobileSearch;
            case 'container-width':
                return window.innerWidth;
            case 'container-height':
                return window.innerHeight;
        }
    }

    actions_handler(action) {
        switch(action.type) {
            case 'TOGGLE_SIDEBAR':
                this.state.visibleSidebar = !this.state.visibleSidebar;
                onSidebarVisibilityChange( this.state.visibleSidebar );
                this.cache.set('visible-sidebar', this.state.visibleSidebar);
                this.emit( 'sidebar-visibility-change' );
                break;
            case 'CHANGE_MOBILE_SEARCH_VISIBILITY':
                this.state.visibleMobileSearch = action.visible;
                this.emit( 'mobile-search-visibility-change' );
                break;
        }
    }
}

export default exportStore( new LayoutStore, 'actions_handler' );
