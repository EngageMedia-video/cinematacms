import React, { useEffect, useRef, useState, useImperativeHandle, useCallback } from 'react';

import { default as Popup } from './Popup';

import { hasClassname } from './functions/dom';

export function PopupContent(props) {
	const wrapperRef = useRef(null);

	const [isVisible, setVisibility] = useState(false);

	const onClickOutside = useCallback((ev) => {
		if (hasClassname(ev.target, 'popup-fullscreen-overlay')) {
			// console.log('ON CLICK OUTSIDE #1');
			hide();
			return;
		}

		if (wrapperRef.current && !wrapperRef.current.contains(ev.target)) {
			// console.log('ON CLICK OUTSIDE #2');
			hide();
		}
	}, []);

	const onKeyDown = useCallback((ev) => {
		// console.log('ON KEY DOWN');
		let key = ev.keyCode || ev.charCode;
		if (27 === key) {
			// TODO: Does it really need?
			onClickOutside(ev);
		}
	}, []);

	function enableListeners() {
		// console.log("ENABLE LISTENERS");
		document.addEventListener('click', onClickOutside);
		document.addEventListener('keydown', onKeyDown);
	}

	function disableListeners() {
		// console.log("DISABLE LISTENERS");
		document.removeEventListener('click', onClickOutside);
		document.removeEventListener('keydown', onKeyDown);
	}

	function show() {
		setVisibility(true);
	}

	function hide() {
		disableListeners();
		setVisibility(false);
	}

	function toggle() {
		if (isVisible) {
			hide();
		} else {
			show();
		}
	}

	function tryToHide() {
		if (isVisible) {
			hide();
		}
	}

	function tryToShow() {
		if (!isVisible) {
			show();
		}
	}

	useEffect(() => {
		if (isVisible) {
			// Delay adding the "click outside" listener to the next animation frame.
			// React 18+ with createRoot delegates events to the root container, not
			// document. When useEffect flushes during a discrete event (click), the
			// originating click still bubbles up to document and would immediately
			// trigger onClickOutside, closing the popup the instant it opens.
			const frameId = requestAnimationFrame(() => {
				enableListeners();
			});
			if ('function' === typeof props.showCallback) {
				props.showCallback();
			}
			return () => {
				cancelAnimationFrame(frameId);
				disableListeners();
			};
		} else {
			if ('function' === typeof props.hideCallback) {
				props.hideCallback();
			}
		}
	}, [isVisible]);

	useImperativeHandle(props.contentRef, () => ({
		toggle,
		tryToHide,
		tryToShow,
	}));

	return isVisible ? (
		<Popup ref={wrapperRef} className={props.className} style={props.style}>
			{props.children}
		</Popup>
	) : null;
}
