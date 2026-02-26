import React, { useRef } from 'react';

import { useThemeSwitcher } from './hooks/useThemeSwitcher';

import "../styles/ThemeSwitchOption.scss";

export function HeaderThemeSwitcher(){
    
    const [ mode, toggleMode ] = useThemeSwitcher();

    const inputRef = useRef(null);

    function onKeyPress(ev){
        if( 0 === ev.keyCode ){
            toggleMode();
        }
    }

    function onClick(ev){
        if( ev.target !== inputRef.current ){
            toggleMode();
        }
    }

    function onChange(ev){
        ev.stopPropagation();
        toggleMode();
    }

    return ( <div className="theme-switch" tabIndex={0} onKeyPress={ onKeyPress } onClick={ onClick }>
                    <span>Dark Theme</span>
                    <span>
                        <label className="checkbox-label right-selectbox">

                            <span className="checkbox-switcher-wrap">
                                <span className="checkbox-switcher">
                                    <input ref={ inputRef } type="checkbox" tabIndex={-1} checked={ 'dark' === mode } onChange={ onChange } />
                                </span>
                            </span>

                        </label>
                    </span>
                </div> );
}
