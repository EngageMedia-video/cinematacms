const monthList = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

export function formatManagementTableDate(date) {
	const day = date.getDate();
	const month = monthList[date.getMonth()].substring(0, 3);
	const year = date.getFullYear();

	const hours = date.getHours();
	const minutes = date.getMinutes();
	const seconds = date.getSeconds();

	const ret =
		month +
		' ' +
		day +
		', ' +
		year +
		' ' +
		(hours < 10 ? '0' : '') +
		hours +
		':' +
		(minutes < 10 ? '0' : '') +
		minutes +
		':' +
		(seconds < 10 ? '0' : '') +
		seconds;

	return ret;
}
