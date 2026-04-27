export default function (image_url) {
	let ext;
	if (image_url) {
		ext = image_url.split('.');
		return ext[ext.length - 1];
	}
	return void 0;
}
