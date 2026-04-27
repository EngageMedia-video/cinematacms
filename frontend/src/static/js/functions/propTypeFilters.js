import { isPositiveInteger, isPositiveIntegerOrZero } from './math';
import { logErrorAndReturnError } from './errors';

export const PositiveIntegerOrZero = (function () {
	return function (obj, key, comp) {
		return void 0 === obj[key] || isPositiveIntegerOrZero(obj[key])
			? null
			: logErrorAndReturnError([
					'Invalid prop `' +
						key +
						'` of type `' +
						typeof obj[key] +
						'` supplied to `' +
						(comp || 'N/A') +
						'`, expected `positive integer or zero` (' +
						obj[key] +
						').',
				]);
	};
})();

export const PositiveInteger = (function () {
	return function (obj, key, comp) {
		return void 0 === obj[key] || isPositiveInteger(obj[key])
			? null
			: logErrorAndReturnError([
					'Invalid prop `' +
						key +
						'` of type `' +
						typeof obj[key] +
						'` supplied to `' +
						(comp || 'N/A') +
						'`, expected `positive integer` (' +
						obj[key] +
						').',
				]);
	};
})();
