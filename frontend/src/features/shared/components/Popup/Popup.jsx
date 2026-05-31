import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { cn } from '../../utils/classNames';

function hasClassname(element, className) {
	return element?.className && new RegExp('(\\s|^)' + className + '(\\s|$)').test(element.className);
}

export const Popup = React.forwardRef(function Popup({ children, className = '', style = null }, ref) {
	if (children === undefined) {
		return null;
	}

	return (
		<div
			ref={ref}
			className={cn('z-4 block w-[300px] cursor-default bg-bg-surface text-left shadow-2xl', className)}
			style={style || undefined}
		>
			{children}
		</div>
	);
});

Popup.propTypes = {
	children: PropTypes.node,
	className: PropTypes.string,
	style: PropTypes.object,
};

export function PopupTop({ children, className = '', style = null }) {
	if (children === undefined) {
		return null;
	}

	return (
		<div
			className={cn('bg-bg-primary px-size-4 py-size-4 text-text-on-primary', className)}
			style={style || undefined}
		>
			{children}
		</div>
	);
}

PopupTop.propTypes = {
	children: PropTypes.node,
	className: PropTypes.string,
	style: PropTypes.object,
};

export function PopupMain({ children, className = '', style = null }) {
	if (children === undefined) {
		return null;
	}

	return (
		<div className={cn('overflow-hidden', className)} style={style || undefined}>
			{children}
		</div>
	);
}

PopupMain.propTypes = {
	children: PropTypes.node,
	className: PropTypes.string,
	style: PropTypes.object,
};

export function PopupContent({
	children,
	className = '',
	contentRef,
	hideCallback = null,
	showCallback = null,
	style = null,
}) {
	const wrapperRef = useRef(null);
	const [isVisible, setVisibility] = useState(false);

	const hide = useCallback(() => {
		setVisibility(false);
	}, []);

	const onClickOutside = useCallback(
		(event) => {
			if (hasClassname(event.target, 'popup-fullscreen-overlay')) {
				hide();
				return;
			}

			if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				hide();
			}
		},
		[hide]
	);

	const onKeyDown = useCallback(
		(event) => {
			if (event.key === 'Escape') {
				onClickOutside(event);
			}
		},
		[onClickOutside]
	);

	const disableListeners = useCallback(() => {
		document.removeEventListener('click', onClickOutside);
		document.removeEventListener('keydown', onKeyDown);
	}, [onClickOutside, onKeyDown]);

	const enableListeners = useCallback(() => {
		document.addEventListener('click', onClickOutside);
		document.addEventListener('keydown', onKeyDown);
	}, [onClickOutside, onKeyDown]);

	const show = useCallback(() => {
		setVisibility(true);
	}, []);

	const hideWithListeners = useCallback(() => {
		disableListeners();
		hide();
	}, [disableListeners, hide]);

	const toggle = useCallback(() => {
		if (isVisible) {
			hideWithListeners();
		} else {
			show();
		}
	}, [hideWithListeners, isVisible, show]);

	const tryToHide = useCallback(() => {
		if (isVisible) {
			hideWithListeners();
		}
	}, [hideWithListeners, isVisible]);

	const tryToShow = useCallback(() => {
		if (!isVisible) {
			show();
		}
	}, [isVisible, show]);

	useEffect(() => {
		if (isVisible) {
			const frameId = requestAnimationFrame(() => {
				enableListeners();
			});

			showCallback?.();

			return () => {
				cancelAnimationFrame(frameId);
				disableListeners();
			};
		}

		hideCallback?.();

		return undefined;
	}, [disableListeners, enableListeners, hideCallback, isVisible, showCallback]);

	useImperativeHandle(
		contentRef,
		() => ({
			toggle,
			tryToHide,
			tryToShow,
		}),
		[toggle, tryToHide, tryToShow]
	);

	return isVisible ? (
		<Popup ref={wrapperRef} className={className} style={style}>
			{children}
		</Popup>
	) : null;
}

PopupContent.propTypes = {
	children: PropTypes.node,
	className: PropTypes.string,
	contentRef: PropTypes.shape({ current: PropTypes.object }),
	hideCallback: PropTypes.func,
	showCallback: PropTypes.func,
	style: PropTypes.object,
};

export function PopupTrigger({ children, contentRef }) {
	if (!React.isValidElement(children)) {
		return children;
	}

	const onClick = (event) => {
		children.props.onClick?.(event);

		if (!event.defaultPrevented) {
			contentRef.current?.toggle();
		}
	};

	return React.cloneElement(children, { onClick });
}

PopupTrigger.propTypes = {
	children: PropTypes.element,
	contentRef: PropTypes.shape({ current: PropTypes.object }).isRequired,
};

export function usePopup() {
	const popupContentRef = useRef(null);

	return popupContentRef;
}
