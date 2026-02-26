import React, { useRef, useState, useEffect } from 'react';

import { SidebarNavigationMenu } from './SidebarNavigationMenu';
import { SidebarBelowNavigationMenu } from './SidebarBelowNavigationMenu';
import { SidebarBelowThemeSwitcher } from './SidebarBelowThemeSwitcher';
import { SidebarThemeSwitcher } from './SidebarThemeSwitcher';
import { SidebarBottom } from './SidebarBottom';

import PageStore from '../../pages/_PageStore.js';

import LayoutStore from '../../stores/LayoutStore.js';
import * as LayoutActions from '../../actions/LayoutActions.js';

import "../styles/PageSidebar.scss";

export function PageSidebar(){

    const containerRef = useRef(null);

    const [ isVisible, setIsVisible ] = useState( LayoutStore.get('visible-sidebar') );
    const [ isRendered, setIsRendered ] = useState( LayoutStore.get('visible-sidebar') || 492 > PageStore.get( 'window-inner-width' ) );
    const [ isFixedBottom, setIsFixedBottom ] = useState( true );

    let sidebarBottomInited = false;
    let sidebarBottomDom = null;
    let sidebarBottomDomPrevSibling = null;

    let bottomInited = false;

    let isAbsoluteThemeSwitcher = false;

    function initBottom(){

        if( bottomInited || ! PageStore.get('config-contents').sidebar.footer ){
            return;
        }

        sidebarBottomDom = document.querySelector('.page-sidebar-bottom');
        sidebarBottomDomPrevSibling = sidebarBottomDom.previousSibling;

        if( 'relative' !== getComputedStyle(sidebarBottomDomPrevSibling).position ){
            isAbsoluteThemeSwitcher = true;
            // sidebarBottomDom = sidebarBottomDomPrevSibling;
            // sidebarBottomDomPrevSibling = sidebarBottomDomPrevSibling.previousSibling;
        }

        bottomInited = true;

        PageStore.on('window_resize', onWindowResize);

        let cntr = 0;
        let sameCntr = 0;
        let siblingBottomPosition = 0;

        function bottomInitPos(){
            
            const newSiblingBottomPosition = sidebarBottomDomPrevSibling.offsetTop + sidebarBottomDomPrevSibling.offsetHeight;

            if( newSiblingBottomPosition !== siblingBottomPosition ){
                siblingBottomPosition = newSiblingBottomPosition;
            }
            else{
                sameCntr += 1;
            }

            cntr += 1;

            // Check every 10ms, until there is no change within 100ms or passed 500ms.

            if( 10 > sameCntr && 50 > cntr ){
                setTimeout( bottomInitPos, 10 );
            }

            onWindowResize();
        }

        bottomInitPos();
    }

    function onWindowResize(){
        // console.log( sidebarBottomDomPrevSibling );

        let prevElem = sidebarBottomDomPrevSibling;
        let bottomElHeight = sidebarBottomDom.offsetHeight;

        if( isAbsoluteThemeSwitcher ){
            bottomElHeight += prevElem.offsetHeight;
            prevElem = prevElem.previousSibling;
        }

        // if( isAbsoluteThemeSwitcher ){
        //     setIsFixedBottom( ! ( prevElem.offsetTop + prevElem.offsetHeight + bottomElHeight > window.innerHeight - containerRef.current.offsetTop ) );
        // }
        // else{
            setIsFixedBottom( ! ( prevElem.offsetTop + prevElem.offsetHeight + bottomElHeight > window.innerHeight - containerRef.current.offsetTop ) );
        // }
        setIsVisible( LayoutStore.get('visible-sidebar') );
    }

    function onVisibilityChange(){
        setIsRendered( true );
        setIsVisible( LayoutStore.get('visible-sidebar') );
        setTimeout( initBottom, 20 );    // Must delay at least 20ms.
    }

    useEffect(() => {

        LayoutStore.on('sidebar-visibility-change', onVisibilityChange);

        if( isVisible || isRendered ){
            initBottom();
        }

        return () => {

            if( bottomInited ){
                PageStore.removeListener('window_resize', onWindowResize);
            }

            LayoutStore.removeListener('sidebar-visibility-change', onVisibilityChange);
        };
    }, []);

    return (<div ref={ containerRef } className={ "page-sidebar" + ( isFixedBottom ? " fixed-bottom" : "" ) }>
                <div className='page-sidebar-inner'>
                    { isVisible || isRendered ? <SidebarNavigationMenu /> : null }
                    { isVisible || isRendered ? <SidebarBelowNavigationMenu /> : null }
                    { isVisible || isRendered ? <SidebarThemeSwitcher /> : null }
                    { isVisible || isRendered ? <SidebarBelowThemeSwitcher /> : null }
                    { isVisible || isRendered ? <SidebarBottom /> : null }
                </div>
            </div>);
}