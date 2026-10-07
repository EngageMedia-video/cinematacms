import { useCallback, useEffect, useRef, useState } from 'react';

// Only a plain click that replaces this document unloads the page and its edits.
function unloadsThisPage(event, link) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
	if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return false;
	if (!/^https?:$/.test(link.protocol)) return false;

	const [linkDocument] = link.href.split('#');
	const [currentDocument] = window.location.href.split('#');
	return !(link.href.includes('#') && linkDocument === currentDocument);
}

export function useUnsavedChangesGuard(hasUnsavedChanges) {
	const disarmedRef = useRef(false);
	const [pendingLeave, setPendingLeave] = useState(null);

	useEffect(() => {
		// Listen only while dirty: a prompt on clean exits trains users to dismiss it.
		if (!hasUnsavedChanges) return undefined;

		function warnBeforeUnload(event) {
			if (disarmedRef.current) return;
			event.preventDefault();
			// Chrome and Edge before 119 prompt only when returnValue is set.
			event.returnValue = true;
		}

		window.addEventListener('beforeunload', warnBeforeUnload);
		return () => window.removeEventListener('beforeunload', warnBeforeUnload);
	}, [hasUnsavedChanges]);

	// Browsers cannot style the beforeunload prompt, so links on the page ask in the
	// design system dialog instead. Reload, closing the tab and Back still use the prompt.
	useEffect(() => {
		if (!hasUnsavedChanges) return undefined;

		function confirmLinkNavigation(event) {
			const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
			if (!link || event.defaultPrevented || disarmedRef.current || !unloadsThisPage(event, link)) return;

			event.preventDefault();
			setPendingLeave(() => () => window.location.assign(link.href));
		}

		document.addEventListener('click', confirmLinkNavigation);
		return () => document.removeEventListener('click', confirmLinkNavigation);
	}, [hasUnsavedChanges]);

	// Call right before a programmatic navigation that keeps the changes, such as
	// a redirect after saving. A state update would land after unload starts.
	const disarm = useCallback(() => {
		disarmedRef.current = true;
	}, []);

	function requestLeave(navigate) {
		if (hasUnsavedChanges && !disarmedRef.current) {
			setPendingLeave(() => navigate);
		} else {
			navigate();
		}
	}

	function confirmLeave() {
		disarm();
		setPendingLeave(null);
		pendingLeave?.();
	}

	return {
		disarm,
		isConfirmingLeave: pendingLeave !== null,
		requestLeave,
		cancelLeave: () => setPendingLeave(null),
		confirmLeave,
	};
}
