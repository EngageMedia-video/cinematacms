function isGt(x, y) {
	return x > y;
}
function isZero(x) {
	return 0 === x;
}
function isInteger(x) {
	return x === Math.trunc(x);
}
function isPositive(x) {
	return isGt(x, 0);
}
export function isPositiveInteger(x) {
	return isInteger(x) && isPositive(x);
}
export function isPositiveIntegerOrZero(x) {
	return isInteger(x) && (isPositive(x) || isZero(x));
}
