export function replaceString(string) {
	for (const key in window.REPLACEMENTS) {
		string = string.replace(key, window.REPLACEMENTS[key]);
	}
	return string;
}
