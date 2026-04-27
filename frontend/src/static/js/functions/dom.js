export function removeClassname(el, cls) {
	if (el.classList) {
		el.classList.remove(cls);
	} else {
		el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
	}
}

export function addClassname(el, cls) {
	if (el.classList) {
		el.classList.add(cls);
	} else {
		el.className += ' ' + cls;
	}
}

export function hasClassname(el, cls) {
	return el.className && new RegExp('(\\s|^)' + cls + '(\\s|$)').test(el.className);
}

export function toggleClassname(el, cls) {
	(hasClassname(el, cls) ? removeClassname : addClassname)(el, cls);
}
