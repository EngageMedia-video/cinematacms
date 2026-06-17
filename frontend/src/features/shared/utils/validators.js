// Field validators for TextField / EditorField.
//
// A validator is a function `(value: string) => string` that returns an error
// message when the value is invalid, or an empty string when it is valid.
// Pass a single validator or an array of them to a field's `validate` prop:
//
//   <EditorField validate={[required(), maxWords(80)]} />
//
// Validators run in order; the first non-empty message wins.

function toText(value) {
	return value === null || value === undefined ? '' : String(value);
}

function countWords(value) {
	const words = toText(value).trim().split(/\s+/).filter(Boolean);
	return words.length;
}

export function required(message = 'This field is required') {
	return (value) => (toText(value).trim().length === 0 ? message : '');
}

export function maxWords(max, message) {
	return (value) => (countWords(value) > max ? message ?? `Maximum ${max} words` : '');
}

export function maxLength(max, message) {
	return (value) => (toText(value).length > max ? message ?? `Maximum ${max} characters` : '');
}

export function minLength(min, message) {
	const text = (value) => toText(value);
	return (value) => (text(value).length > 0 && text(value).length < min ? message ?? `Minimum ${min} characters` : '');
}

export function pattern(regex, message = 'Invalid format') {
	return (value) => {
		const text = toText(value);
		return text.length > 0 && !regex.test(text) ? message : '';
	};
}

// Runs a validator or array of validators against a value.
// Returns the first error message, or '' when everything passes.
export function runValidators(validate, value) {
	if (!validate) {
		return '';
	}

	const validators = Array.isArray(validate) ? validate : [validate];

	for (const validator of validators) {
		const message = typeof validator === 'function' ? validator(value) : '';

		if (message) {
			return message;
		}
	}

	return '';
}
