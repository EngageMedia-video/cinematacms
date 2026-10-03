import { useCallback, useEffect, useRef } from 'react';

export function useUnsavedChangesGuard(hasUnsavedChanges) {
	const disarmedRef = useRef(false);

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

	// Call right before a programmatic navigation that keeps the changes, such as
	// a redirect after saving. A state update would land after unload starts.
	const disarm = useCallback(() => {
		disarmedRef.current = true;
	}, []);

	return { disarm };
}
