// Returns true only for an unmodified left-click. Modified clicks
// (Ctrl/Cmd/Shift/Alt + middle/right click) should retain the browser's
// native behaviour, e.g. open the link in a new tab, without triggering
// onSelect side-effects like closing the dropdown.
export function isPlainLeftClick(event) {
	return !(
		event.defaultPrevented ||
		event.button !== 0 ||
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey ||
		event.altKey
	);
}
