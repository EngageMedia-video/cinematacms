export function toBe(label, condition, expectedValue) {
	test(label, function () {
		return expect(condition).toBe(expectedValue);
	}); // @todo: Check its dependency from jest.
}

export function toBeTrue(label, condition) {
	toBe(label, condition, true);
}

export function toBeFalse(label, condition) {
	toBe(label, condition, false);
}
