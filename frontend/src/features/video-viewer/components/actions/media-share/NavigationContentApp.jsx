import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export function NavigationContentApp({
	initPage,
	pages,
	pageChangeSelector,
	pageIdSelectorAttr,
	focusFirstItemOnPageChange = true,
	pageChangeCallback,
}) {
	const containerRef = useRef(null);
	const changeElementsRef = useRef([]);
	const [currentPage, setCurrentPage] = useState(null);

	function changePage(newPage) {
		if (pages[newPage] !== undefined) {
			setCurrentPage(newPage);
		}
	}

	function clearEvents() {
		for (const entry of changeElementsRef.current) {
			entry.elem.removeEventListener('click', entry.listener);
		}
		changeElementsRef.current = [];
	}

	function initEvents() {
		const domElem = containerRef.current;
		if (!domElem) return;

		const elems = domElem.querySelectorAll(pageChangeSelector);
		for (const elem of elems) {
			const pageId = elem.getAttribute(pageIdSelectorAttr)?.trim();
			if (!pageId) continue;
			const listener = (event) => {
				event.preventDefault();
				event.stopPropagation();
				changePage(pageId);
			};
			elem.addEventListener('click', listener);
			changeElementsRef.current.push({ elem, listener });
		}

		if (focusFirstItemOnPageChange) {
			domElem.focus();
		}
	}

	useEffect(() => {
		if (pages[initPage] !== undefined) {
			setCurrentPage(initPage);
		} else if (Object.keys(pages).length) {
			setCurrentPage(Object.keys(pages)[0]);
		} else {
			setCurrentPage(null);
		}
	}, [initPage]);

	useEffect(() => {
		clearEvents();
		if (currentPage) {
			initEvents();
			pageChangeCallback?.(currentPage);
		}
		return clearEvents;
	}, [currentPage]);

	if (!currentPage) return null;

	return <div ref={containerRef}>{React.cloneElement(pages[currentPage])}</div>;
}

NavigationContentApp.propTypes = {
	initPage: PropTypes.string,
	pages: PropTypes.object.isRequired,
	pageChangeSelector: PropTypes.string.isRequired,
	pageIdSelectorAttr: PropTypes.string.isRequired,
	focusFirstItemOnPageChange: PropTypes.bool,
	pageChangeCallback: PropTypes.func,
};
