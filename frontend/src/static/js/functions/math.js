export function isGt(x, y) {
	return x > y;
}
export function isZero(x) {
	return 0 === x;
}
export function isNumber(x) {
	return !isNaN(x) && x === 0 + x;
}
export function isInteger(x) {
	return x === Math.trunc(x);
}
export function isPositive(x) {
	return isGt(x, 0);
}
export function isPositiveNumber(x) {
	return isNumber(x) && isPositive(x);
}
export function isPositiveInteger(x) {
	return isInteger(x) && isPositive(x);
}
export function isPositiveIntegerOrZero(x) {
	return isInteger(x) && (isPositive(x) || isZero(x));
}
