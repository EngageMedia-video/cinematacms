export function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}
