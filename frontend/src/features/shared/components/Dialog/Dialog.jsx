import { cn } from '../../utils/classNames';
import { cloneElement, createContext, isValidElement, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const DialogContext = createContext(null);
const FOCUSABLE_SELECTOR =
	'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function callHandler(handler, event) {
	if (typeof handler === 'function') {
		handler(event);
	}
}

function useDialogContext(componentName) {
	const context = useContext(DialogContext);

	if (!context) {
		throw new Error(`${componentName} must be used within Dialog.`);
	}

	return context;
}

function getFocusableElements(container) {
	if (!container) {
		return [];
	}

	return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
		(element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
	);
}

function focusDialogElement(container) {
	const [firstFocusable] = getFocusableElements(container);
	(firstFocusable ?? container)?.focus();
}

export function Dialog({ children, open, defaultOpen = false, onOpenChange }) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const isControlled = open !== undefined;
	const isOpen = isControlled ? open : internalOpen;

	function setOpen(nextOpen) {
		if (!isControlled) {
			setInternalOpen(nextOpen);
		}

		onOpenChange?.(nextOpen);
	}

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		function handleKeyDown(event) {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [isOpen]);

	return <DialogContext.Provider value={{ isOpen, setOpen }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ children }) {
	const { isOpen, setOpen } = useDialogContext('DialogTrigger');

	if (!isValidElement(children)) {
		throw new Error('DialogTrigger expects a single valid React element child.');
	}

	return cloneElement(children, {
		'aria-expanded': isOpen,
		'aria-haspopup': 'dialog',
		'data-state': isOpen ? 'open' : 'closed',
		onClick: (event) => {
			callHandler(children.props.onClick, event);

			if (!event.defaultPrevented) {
				setOpen(true);
			}
		},
	});
}

export function DialogClose({ children }) {
	const { isOpen, setOpen } = useDialogContext('DialogClose');

	if (!isValidElement(children)) {
		throw new Error('DialogClose expects a single valid React element child.');
	}

	return cloneElement(children, {
		'aria-expanded': isOpen,
		'data-state': isOpen ? 'open' : 'closed',
		onClick: (event) => {
			callHandler(children.props.onClick, event);

			if (!event.defaultPrevented) {
				setOpen(false);
			}
		},
	});
}

export function DialogContent({
	children,
	className = '',
	overlayClassName = '',
	'aria-label': ariaLabel = 'Dialog',
	closeOnOverlayClick = true,
	...props
}) {
	const { isOpen, setOpen } = useDialogContext('DialogContent');
	const contentRef = useRef(null);
	const portalNodeRef = useRef(null);
	const previousActiveRef = useRef(null);

	if (!portalNodeRef.current && typeof document !== 'undefined') {
		portalNodeRef.current = document.createElement('div');
	}

	useEffect(() => {
		const portalNode = portalNodeRef.current;

		if (!portalNode || typeof document === 'undefined') {
			return undefined;
		}

		document.body.appendChild(portalNode);

		return () => {
			portalNode.remove();
		};
	}, []);

	useEffect(() => {
		if (!isOpen) {
			return undefined;
		}

		previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		focusDialogElement(contentRef.current);

		function handleFocusIn(event) {
			if (!contentRef.current || contentRef.current.contains(event.target)) {
				return;
			}

			focusDialogElement(contentRef.current);
		}

		function handleTabKey(event) {
			if (event.key !== 'Tab' || !contentRef.current) {
				return;
			}

			const focusableElements = getFocusableElements(contentRef.current);
			if (!focusableElements.length) {
				event.preventDefault();
				contentRef.current.focus();
				return;
			}

			const firstFocusable = focusableElements[0];
			const lastFocusable = focusableElements[focusableElements.length - 1];

			if (event.shiftKey && document.activeElement === firstFocusable) {
				event.preventDefault();
				lastFocusable.focus();
			}

			if (!event.shiftKey && document.activeElement === lastFocusable) {
				event.preventDefault();
				firstFocusable.focus();
			}
		}

		const siblings = [...document.body.children].filter((element) => element !== portalNodeRef.current);
		const siblingState = siblings.map((element) => ({
			element,
			ariaHidden: element.getAttribute('aria-hidden'),
			inert: element.hasAttribute('inert'),
		}));

		siblings.forEach((element) => {
			element.setAttribute('aria-hidden', 'true');
			element.setAttribute('inert', '');
		});

		document.addEventListener('focusin', handleFocusIn);
		document.addEventListener('keydown', handleTabKey);

		return () => {
			document.removeEventListener('focusin', handleFocusIn);
			document.removeEventListener('keydown', handleTabKey);

			siblingState.forEach(({ element, ariaHidden, inert }) => {
				if (ariaHidden === null) {
					element.removeAttribute('aria-hidden');
				} else {
					element.setAttribute('aria-hidden', ariaHidden);
				}

				if (inert) {
					element.setAttribute('inert', '');
				} else {
					element.removeAttribute('inert');
				}
			});

			const previousActiveElement = previousActiveRef.current;
			if (previousActiveElement?.isConnected) {
				previousActiveElement.focus();
			}
		};
	}, [isOpen]);

	if (!isOpen || typeof document === 'undefined' || !portalNodeRef.current) {
		return null;
	}

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div
				aria-hidden="true"
				data-dialog-overlay
				className={cn('absolute inset-0 bg-bg-overlay-dark/40 dark:opacity-80', overlayClassName)}
				onClick={() => {
					if (closeOnOverlayClick) {
						setOpen(false);
					}
				}}
			/>

			<div
				{...props}
				ref={contentRef}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				tabIndex={-1}
				data-state="open"
				className={cn('relative z-10 outline-none', className)}
			>
				{children}
			</div>
		</div>,
		portalNodeRef.current
	);
}

Dialog.Trigger = DialogTrigger;
Dialog.Close = DialogClose;
Dialog.Content = DialogContent;
