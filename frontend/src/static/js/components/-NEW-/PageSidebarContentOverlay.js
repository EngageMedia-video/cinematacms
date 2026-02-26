import React, { useEffect, useRef } from 'react';

import * as LayoutActions from '../../actions/LayoutActions.js';

import "../styles/PageSidebarContentOverlay.scss";

export function PageSidebarContentOverlay(){

    const containerRef = useRef(null);

    function onClick(ev){
        ev.preventDefault();
        ev.stopPropagation();
        LayoutActions.toggleSidebar();
    }

    useEffect(() => {
        containerRef.current.addEventListener( 'click', onClick );
        return () => containerRef.current.removeEventListener( 'click', onClick );
    },[]);

    return ( <div ref={ containerRef } className='page-sidebar-content-overlay'></div> );
}
