import ViewerInfoVideoTitleBanner from './ViewerInfoVideoTitleBanner';

import ViewerInfo from './ViewerInfo';

export default class ViewerInfoVideo extends ViewerInfo {
	renderTitleBanner({ allowDownload, categories, published, title, views }) {
		return (
			<ViewerInfoVideoTitleBanner
				title={title}
				published={published}
				views={views}
				categories={categories}
				allowDownload={allowDownload}
			/>
		);
	}
}
