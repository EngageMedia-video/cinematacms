import React from 'react';
import EventEmitter from 'events';
import BrowserCache from '../classes/BrowserCache.js';
import { exportStore } from '../functions';
import { addClassname, removeClassname } from '../functions/dom.js';
import { config as mediaCmsConfig } from '../mediacms/config.js';
import { supportsSvgAsImg } from '../components/-NEW-/functions/dom';

function initLogo(logo){

    let light = null;
    let dark = null;

    if( void 0 !== logo.darkMode ){

        if( supportsSvgAsImg() && void 0 !== logo.darkMode.svg && '' !== logo.darkMode.svg ){
            dark = logo.darkMode.svg;
        }
        else if( void 0 !== logo.darkMode.img && '' !== logo.darkMode.img ){
            dark = logo.darkMode.img;
        }
    }

    if( void 0 !== logo.lightMode ){

        if( supportsSvgAsImg() && void 0 !== logo.lightMode.svg && '' !== logo.lightMode.svg ){
            light = logo.lightMode.svg;
        }
        else if( void 0 !== logo.lightMode.img && '' !== logo.lightMode.img ){
            light = logo.lightMode.img;
        }
    }

    if( null !== light || null !== dark ){

        if( null === light ){
            light = dark;
        }
        else if( null === dark ){
            dark = light;
        }
    }

    return {
        light,
        dark,
    };
}

function initMode( cachedValue, defaultValue ){
    return 'light' === cachedValue || 'dark' === cachedValue ? cachedValue : defaultValue;
}

function onModeChange( mode ){
    if( 'dark' === mode ){
        addClassname( document.body, 'dark_theme' );
    }
    else{
        removeClassname( document.body, 'dark_theme' );
    }
}

class ThemeStore extends EventEmitter{

    constructor() {

        super();

        const config = mediaCmsConfig( window.MediaCMS );

        // Keep cache data "fresh" for one day.
        this.cache = new BrowserCache( 'MediaCMS[' + config.site.id + '][theme]', 86400 );

        this.logos = initLogo( config.theme.logo );

        this.state = {
            mode: initMode( this.cache.get('mode'), config.theme.mode ),
        };

        onModeChange( this.state.mode );
    }

    get(type){
        switch(type){
            case 'logo':
                return this.logos[ this.state.mode ];
            case 'mode':
                return this.state.mode;
        }
    }

    actions_handler(action) {
        switch(action.type) {
            case 'TOGGLE_MODE':
                this.state.mode = 'light' === this.state.mode ? 'dark' : 'light';
                onModeChange( this.state.mode );
                this.cache.set('mode', this.state.mode);
                this.emit( 'mode-change' );
                break;
        }
    }
}

export default exportStore( new ThemeStore, 'actions_handler' );

if (import.meta.hot) {
	import.meta.hot.decline();
}
