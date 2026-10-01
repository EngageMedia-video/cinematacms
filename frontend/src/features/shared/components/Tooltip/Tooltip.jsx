import { cn } from '../../utils/classNames';
import { cloneElement, isValidElement, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';

const PLACEMENT_CLASSES = {
	top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
	right: 'left-full top-1/2 ml-2 -translate-y-1/2',
	bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
	left: 'right-full top-1/2 mr-2 -translate-y-1/2',
};

export function Tooltip({
	children,
	content,
	placement = 'top',
	trigger = 'hover',
	open,
	defaultOpen = false,
	onOpenChange,
	className = '',
	contentClassName = '',
}) {
	const tooltipId = useId();
	const wrapperRef = useRef(null);
	const tooltipRef = useRef(null);
	const isControlled = open !== undefined;
	const [internalOpen, setInternalOpen] = useState(defaultOpen);
	const isOpen = isControlled ? open : internalOpen;
	const resolvedPlacement = PLACEMENT_CLASSES[placement] ? placement : 'top';

	useLayoutEffect(() => {
		if (!isOpen) return undefined;
		function keepInViewport() {
			const element = tooltipRef.current;
			if (!element) return;
			element.style.marginLeft = '';
			element.style.marginTop = '';
			const rect = element.getBoundingClientRect();
			const style = getComputedStyle(element);
			const x = Math.max(8 - rect.left, 0) - Math.max(rect.right - window.innerWidth + 8, 0);
			const y = Math.max(8 - rect.top, 0) - Math.max(rect.bottom - window.innerHeight + 8, 0);
			const left = parseFloat(style.marginLeft) || 0;
			const top = parseFloat(style.marginTop) || 0;
			element.style.marginLeft = `${left + x}px`;
			element.style.marginTop = `${top + y}px`;
		}
		keepInViewport();
		window.addEventListener('resize', keepInViewport);
		window.addEventListener('scroll', keepInViewport, true);
		return () => {
			window.removeEventListener('resize', keepInViewport);
			window.removeEventListener('scroll', keepInViewport, true);
		};
	}, [isOpen, resolvedPlacement, content]);

	function setOpen(nextOpen) {
		if (!isControlled) {
			setInternalOpen(nextOpen);
		}

		onOpenChange?.(nextOpen);
	}

	useEffect(() => {
		if (!isOpen || trigger !== 'click') {
			return undefined;
		}

		function handlePointerDown(event) {
			if (!wrapperRef.current?.contains(event.target)) {
				setOpen(false);
			}
		}

		function handleKeyDown(event) {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [isOpen, trigger]);

	if (!isValidElement(children)) {
		throw new Error('Tooltip expects a single valid React element child.');
	}

	return (
		<span
			ref={wrapperRef}
			className={cn('relative inline-flex max-w-full', className)}
			onMouseEnter={trigger === 'hover' ? () => setOpen(true) : undefined}
			onMouseLeave={trigger === 'hover' ? () => setOpen(false) : undefined}
			onFocus={trigger === 'hover' ? () => setOpen(true) : undefined}
			onBlur={trigger === 'hover' ? () => setOpen(false) : undefined}
		>
			<span
				className="inline-flex"
				onClick={
					trigger === 'click'
						? (event) => {
								if (!event.defaultPrevented) {
									setOpen(!isOpen);
								}
							}
						: undefined
				}
			>
				{cloneElement(children, {
					'aria-describedby': isOpen ? tooltipId : undefined,
					'data-state': isOpen ? 'open' : 'closed',
					'aria-haspopup': 'true',
					'aria-expanded': trigger === 'click' ? isOpen : undefined,
				})}
			</span>

			{isOpen ? (
				<div
					ref={tooltipRef}
					id={tooltipId}
					role="tooltip"
					className={cn(
						'body-body-14-regular absolute z-20 w-[250px] max-w-[calc(100vw-1rem)] rounded-[8px] border border-border-subtle bg-bg-surface-raised px-3 py-1.5 leading-[1.2] text-text-strong',
						PLACEMENT_CLASSES[resolvedPlacement],
						contentClassName
					)}
				>
					{content}
				</div>
			) : null}
		</span>
	);
}
