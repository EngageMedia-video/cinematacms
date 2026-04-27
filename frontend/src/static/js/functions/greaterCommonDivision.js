export default function greaterCommonDivision(a, b) {
	if (!b) {
		return a;
	}
	return greaterCommonDivision(b, a % b);
}
