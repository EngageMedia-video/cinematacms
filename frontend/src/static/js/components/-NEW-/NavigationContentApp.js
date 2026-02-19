import React, { useState, useEffect, useRef } from 'react';

import PropTypes from 'prop-types';

export function NavigationContentApp(props){
	props = { focusFirstItemOnPageChange: true, ...props };

	const containerRef = useRef(null);

	const [ currentPage, setCurrentPage ] = useState( null );

	const changePageElementsRef = useRef([]);

	function initEvents(){

		let domElem = containerRef.current;
		let elems = domElem.querySelectorAll( props.pageChangeSelector );

		let i, pageId;

		if( elems.length ){

			i = 0;
			while(i<elems.length){

				pageId = elems[i].getAttribute( props.pageIdSelectorAttr );
				pageId = pageId ? pageId.trim() : pageId;

				if( pageId ){

					const entry = {
						id: pageId,
						elem: elems[i],
					};

					const entryIndex = changePageElementsRef.current.length;
					entry.listener = ( index => event => changePageListener(index, event) )(entryIndex);
					entry.elem.addEventListener('click', entry.listener);
					changePageElementsRef.current.push(entry);
				}

				i += 1;
			}
		}

		if( props.focusFirstItemOnPageChange ){
			domElem.focus();
		}
	}

	function clearEvents(){
		let i = 0;
		while(i<changePageElementsRef.current.length){
			changePageElementsRef.current[i].elem.removeEventListener('click', changePageElementsRef.current[i].listener);
			i += 1;
		}
		changePageElementsRef.current = [];
	}

	function changePageListener(index, event){
		event.preventDefault();
		event.stopPropagation();
		changePage( changePageElementsRef.current[index].id );
	}

	function changePage(newPage){
		if( void 0 !== props.pages[newPage] ){
			setCurrentPage(newPage);
		}
	}

	useEffect(()=>{

		if( void 0 !== props.pages[ props.initPage ] ){
			setCurrentPage( props.initPage );
		}
		else if( Object.keys( props.pages ).length ){
			setCurrentPage( Object.keys( props.pages )[0] );
		}
		else{
			setCurrentPage(null);
		}

	}, [props.initPage]);

	useEffect(()=>{

		clearEvents();

		if( currentPage ){

			initEvents();

			if( 'function' === typeof props.pageChangeCallback ){
				props.pageChangeCallback(currentPage);
			}
		}

		return () => { clearEvents(); };

	}, [currentPage]);
	
	return ( ! currentPage ? null : <div ref={ containerRef }>{ React.cloneElement(props.pages[currentPage]) }</div> );
}

NavigationContentApp.propTypes = {
	initPage: PropTypes.string,
	pages: PropTypes.object.isRequired,
	pageChangeSelector: PropTypes.string.isRequired,
	pageIdSelectorAttr: PropTypes.string.isRequired,
	focusFirstItemOnPageChange: PropTypes.bool,
	pageChangeCallback: PropTypes.func,
};

