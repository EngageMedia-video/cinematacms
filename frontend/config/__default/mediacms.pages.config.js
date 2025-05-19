const fs = require("fs");
const path = require("path");

const ejs = require("ejs");
const merge = require("lodash.merge");

const templatesPath = path.join(__dirname, "../templates");
const staticTemplatesPath = path.join(
	__dirname,
	"../templates/static/__default"
);

const staticTemplates = {
	errorPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "errorPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "errorPage.html"),
			outputFunctionName: "echo",
		}
	),
	aboutPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "aboutPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "aboutPage.html"),
			outputFunctionName: "echo",
		}
	),
	termsPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "termsPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "termsPage.html"),
			outputFunctionName: "echo",
		}
	),
	contactPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "contactPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "contactPage.html"),
			outputFunctionName: "echo",
		}
	),
	signinPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "signinPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "signinPage.html"),
			outputFunctionName: "echo",
		}
	),
	signoutPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "signoutPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "signoutPage.html"),
			outputFunctionName: "echo",
		}
	),
	registerPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "registerPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "registerPage.html"),
			outputFunctionName: "echo",
		}
	),
	resetPasswordPage: ejs.compile(
		fs.readFileSync(
			path.join(staticTemplatesPath, "resetPasswordPage.html"),
			"utf8"
		),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "resetPasswordPage.html"),
			outputFunctionName: "echo",
		}
	),
	editChannelPage: ejs.compile(
		fs.readFileSync(
			path.join(staticTemplatesPath, "editChannelPage.html"),
			"utf8"
		),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "editChannelPage.html"),
			outputFunctionName: "echo",
		}
	),
	editProfilePage: ejs.compile(
		fs.readFileSync(
			path.join(staticTemplatesPath, "editProfilePage.html"),
			"utf8"
		),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "editProfilePage.html"),
			outputFunctionName: "echo",
		}
	),
	addMediaPageTemplate: ejs.compile(
		fs.readFileSync(
			path.join(staticTemplatesPath, "addMediaPageTemplate.html"),
			"utf8"
		),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "addMediaPageTemplate.html"),
			outputFunctionName: "echo",
		}
	),
};

const templates = {
	htmlBodySnippet: ejs.compile(
		fs.readFileSync(path.join(templatesPath, "htmlBodySnippet.ejs"), "utf8"),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "htmlBodySnippet.ejs"),
			outputFunctionName: "echo",
		}
	),
	htmlBodySnippetEmbedPage: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "htmlBodySnippetEmbedPage.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "htmlBodySnippetEmbedPage.ejs"),
			outputFunctionName: "echo",
		}
	),
	htmlBodySnippetAddMediaPage: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "htmlBodySnippetAddMediaPage.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "htmlBodySnippetAddMediaPage.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderBase: ejs.compile(
		fs.readFileSync(path.join(templatesPath, "renderBase.ejs"), "utf8"),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderBase.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderPageContent: ejs.compile(
		fs.readFileSync(path.join(templatesPath, "renderPageContent.ejs"), "utf8"),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderTaxonomyPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderTaxonomyPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderTaxonomyPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderManagementPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderManagementPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderManagementPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderPageStaticContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderPageStaticContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderPageStaticContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderMediaPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderMediaPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderMediaPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderPlaylistPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderPlaylistPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderPlaylistPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderProfilePageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderProfilePageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderProfilePageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderEmbedPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderEmbedPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderEmbedPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
	renderAddMediaPageContent: ejs.compile(
		fs.readFileSync(
			path.join(templatesPath, "renderAddMediaPageContent.ejs"),
			"utf8"
		),
		{
			root: [templatesPath],
			filename: path.join(templatesPath, "renderAddMediaPageContent.ejs"),
			outputFunctionName: "echo",
		}
	),
};

function mediacmsPages(id, pageid, title, filename) {
	return {
		title: title,
		filename: void 0 !== filename ? filename : id + ".html",
		html: {
			head: {},
			body: {
				snippet: templates.htmlBodySnippet({ id: pageid }),
			},
		},
		window: {},
	};
}

function mediacmsDefaultPages(id, title, component, extendObj, filename) {
	const pageid = "page-" + id;
	const ret = merge(
		{},
		mediacmsPages("home" === id ? "index" : id, pageid, title, filename),
		{
			render: templates.renderPageContent({
				page: { id: pageid, component: component },
			}),
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/video-js/7.20.2/video.min.js",
							as: "script",
						},
					],
				},
				body: {
					scripts: [{ src: "./static/lib/video-js/7.20.2/video.min.js" }],
				},
			},
		},
		extendObj // Todo: Check nested arrays merge results.
	);
	return ret;
}

function mediacmsTaxonomyPages(id, title, component, extendObj, filename) {
	const pageid = "page-" + id;
	const ret = merge(
		{},
		mediacmsPages(id, pageid, title, filename),
		{
			render: templates.renderTaxonomyPageContent({
				page: { id: pageid, component: component },
			}),
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/video-js/7.20.2/video.min.js",
							as: "script",
						},
					],
				},
				body: {
					scripts: [{ src: "./static/lib/video-js/7.20.2/video.min.js" }],
				},
			},
		},
		extendObj // Todo: Check nested arrays merge results.
	);
	return ret;
}

function mediacmsManagementPages(id, title, component, extendObj, filename) {
	const pageid = "page-" + id;

	const ret = merge(
		{},
		mediacmsPages(id, pageid, title, filename),
		{
			render: templates.renderManagementPageContent({
				page: { id: pageid, component: component },
			}),
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/video-js/7.20.2/video.min.js",
							as: "script",
						},
					],
				},
				body: {
					scripts: [{ src: "./static/lib/video-js/7.20.2/video.min.js" }],
				},
			},
		},
		extendObj // Todo: Check nested arrays merge results.
	);
	return ret;
}

function mediacmsDefaultPagesStatic(id, title, component, extendObj, filename) {
	const pageid = "page-" + id;
	return merge(
		{},
		mediacmsPages(id, pageid, title, filename),
		{
			render: templates.renderPageStaticContent({
				page: { id: pageid, component: component },
			}),
		},
		extendObj
	);
}

function mediacmsDefaultPagesCustomRender(
	id,
	title,
	render,
	extendObj,
	filename
) {
	const pageid = "page-" + id;
	const ret = merge(
		{},
		mediacmsPages(id, pageid, title, filename),
		{
			render,
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/video-js/7.20.2/video.min.js",
							as: "script",
						},
					],
				},
				body: {
					scripts: [{ src: "./static/lib/video-js/7.20.2/video.min.js" }],
				},
			},
		},
		extendObj
	);
	return ret;
}

const profileId = "styiannis";
// const profileId = "markos";

const pages = {
	base: mediacmsDefaultPagesCustomRender(
		"base",
		"Layout base",
		templates.renderBase()
	),
	index: mediacmsDefaultPages("home", "Home", "HomePage", {}),
	search: mediacmsDefaultPages("search", "Search results", "SearchPage", {}),
	latest: mediacmsDefaultPages(
		"latest",
		"Recent uploads",
		"LatestMediaPage",
		{}
	),
	featured: mediacmsDefaultPages(
		"featured",
		"Featured",
		"FeaturedMediaPage",
		{}
	),
	recommended: mediacmsDefaultPages(
		"recommended",
		"Recommended",
		"RecommendedMediaPage",
		{}
	),
	members: mediacmsDefaultPages("members", "Members", "MembersPage", {}),
	// Embedded player page.
	embed: merge(
		{},
		mediacmsDefaultPagesCustomRender(
			"embed",
			"Embedded player",
			templates.renderEmbedPageContent({
				page: { id: "page-embed", component: "EmbedPage" },
			}),
			// { window: { MediaCMS: { mediaId: "rhfBRkoeC" } } }
			{ window: { MediaCMS: { mediaId: "5cGyEMQX3" } } }
		),
		{
			html: {
				body: {
					snippet: templates.htmlBodySnippetEmbedPage({ id: "page-embed" }),
				},
			},
		}
	),
	// Media pages.
	media: mediacmsDefaultPagesCustomRender(
		"media",
		"Media",
		templates.renderMediaPageContent({
			page: { id: "page-media", component: "MediaPage", componentFile: "index" },
		}),
		// { window: { MediaCMS: { mediaId: "rhfBRkoeC" } } }
		{ window: { MediaCMS: { mediaId: "5cGyEMQX3" } } }
	),
	"media-video": mediacmsDefaultPagesCustomRender(
		"media-video",
		"Media - Video",
		templates.renderMediaPageContent({
			page: {
				id: "page-media-video",
				component: "MediaPageVideo",
				componentFile: "Video",
			},
		}),
		// {  buildExclude: true, window: { MediaCMS: { mediaId: "rhfBRkoeC" } } }
		{ buildExclude: true, window: { MediaCMS: { mediaId: "5cGyEMQX3" } } }
	),
	"media-audio": mediacmsDefaultPagesCustomRender(
		"media-audio",
		"Media - Audio",
		templates.renderMediaPageContent({
			page: {
				id: "page-media-audio",
				component: "MediaPageAudio",
				componentFile: "Audio",
			},
		}),
		{ buildExclude: true, window: { MediaCMS: { mediaId: "GqCvho2mJ" } } }
	),
	"media-image": mediacmsDefaultPagesCustomRender(
		"media-image",
		"Media - Image",
		templates.renderMediaPageContent({
			page: {
				id: "page-media-image",
				component: "MediaPageImage",
				componentFile: "Image",
			},
		}),
		{ buildExclude: true, window: { MediaCMS: { mediaId: "o8j9XMxHC" } } }
	),
	"media-pdf": mediacmsDefaultPagesCustomRender(
		"media-pdf",
		"Media - Pdf",
		templates.renderMediaPageContent({
			page: {
				id: "page-media-pdf",
				component: "MediaPagePdf",
				componentFile: "Pdf",
			},
		}),
		{ buildExclude: true, window: { MediaCMS: { mediaId: "bDgPhcpuN" } } }
	),
	// Playlist pages.
	playlist: mediacmsDefaultPagesCustomRender(
		"playlist",
		"Playlist",
		templates.renderPlaylistPageContent({
			page: {
				id: "page-playlist",
				component: "PlaylistPage",
				componentFile: "index",
			},
		}),
		{ buildExclude: false, window: { MediaCMS: { playlistId: "iaSPxN2r8" } } } // playlist from demo.mediacms.io
	),
	// Taxonomy pages.
	tags: mediacmsTaxonomyPages("tags", "Tags", "TagsPage", {}),
	categories: mediacmsTaxonomyPages(
		"categories",
		"Categories",
		"CategoriesPage",
		{}
	),
	/*topics: mediacmsTaxonomyPages('topics', 'Topics', 'TopicsPage', {}),
    languages: mediacmsTaxonomyPages('languages', 'Languages', 'LanguagesPage', {}),
    countries: mediacmsTaxonomyPages('countries', 'Countries', 'CountriesPage', {}),*/
	// Management pages.
	"manage-media": mediacmsManagementPages(
		"manage-media",
		"Manage media",
		"ManageMediaPage",
		{}
	),
	"manage-users": mediacmsManagementPages(
		"manage-users",
		"Manage users",
		"ManageUsersPage",
		{}
	),
	"manage-comments": mediacmsManagementPages(
		"manage-comments",
		"Manage comments",
		"ManageCommentsPage",
		{}
	),
	// User profile pages.
	"profile-about": mediacmsDefaultPagesCustomRender(
		"profile-about",
		"Profile",
		templates.renderProfilePageContent({
			page: {
				id: "page-profile-about",
				component: "ProfileAboutPage",
				componentFile: "About",
			},
		}),
		{ window: { MediaCMS: { profileId: profileId } } }
	),
	"profile-home": mediacmsDefaultPagesCustomRender(
		"profile-home",
		"Profile",
		templates.renderProfilePageContent({
			page: {
				id: "page-profile-home",
				component: "ProfilePage",
				componentFile: "index",
			},
		}),
		{ window: { MediaCMS: { profileId: profileId } } }
	),
	"profile-playlists": mediacmsDefaultPagesCustomRender(
		"profile-playlists",
		"Profile",
		templates.renderProfilePageContent({
			page: {
				id: "page-profile-playlists",
				component: "ProfilePlaylistsPage",
				componentFile: "Playlists",
			},
		}),
		{ buildExclude: false, window: { MediaCMS: { profileId: profileId } } }
	),
	"profile-media": mediacmsDefaultPagesCustomRender(
		"profile-media",
		"Profile",
		templates.renderProfilePageContent({
			page: {
				id: "page-profile-media",
				component: "ProfileMediaPage",
				componentFile: "Media",
			},
		}),
		{ buildExclude: true, window: { MediaCMS: { profileId: profileId } } }
	),
	// Logged in user pages.
	history: mediacmsDefaultPages("history", "History", "HistoryPage", {}),
	liked: mediacmsDefaultPages("liked", "Liked media", "LikedMediaPage", {}),
	// Add media page(s).
	"add-media": mediacmsDefaultPagesCustomRender(
		"add-media",
		"Add media",
		templates.renderAddMediaPageContent(),
		{
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/file-uploader/5.13.0/fine-uploader.min.js",
							as: "script",
						},
						{ src: "" },
					],
					scripts: [],
				},
				body: {
					scripts: [
						{ src: "./static/lib/file-uploader/5.13.0/fine-uploader.min.js" },
					],
					snippet: templates.htmlBodySnippetAddMediaPage(),
				},
			},
		}
	),
	"add-media-template": mediacmsDefaultPagesStatic(
		"add-media-template",
		"Add media - Template",
		"AddMediaPageTemplate",
		{
			buildExclude: true,
			html: {
				head: {
					links: [
						{
							rel: "preload",
							href: "./static/lib/file-uploader/5.13.0/fine-uploader.min.js",
							as: "script",
						},
					],
				},
				body: {
					scripts: [
						{ src: "./static/lib/file-uploader/5.13.0/fine-uploader.min.js" },
					],
					snippet: staticTemplates.addMediaPageTemplate(),
				},
			},
			render: templates.renderAddMediaPageContent(),
		}
	),
	// Static pages.
	error: mediacmsDefaultPagesStatic("error", "Error", "ErrorPage", {
		html: {
			body: {
				snippet: staticTemplates.errorPage(),
			},
		},
		render: templates.renderBase(),
		buildExclude: true,
	}),
	about: mediacmsDefaultPagesStatic("about", "About", "AboutPage", {
		html: {
			body: {
				snippet: staticTemplates.aboutPage(),
			},
		},
		render: templates.renderBase(),
	}),
	terms: mediacmsDefaultPagesStatic("terms", "Terms", "TermsPage", {
		buildExclude: true,
		html: {
			body: {
				snippet: staticTemplates.termsPage(),
			},
		},
		render: templates.renderBase(),
	}),
	// Dev-only static pages.
	"edit-media": mediacmsDefaultPagesStatic(
		"edit-media",
		"Edit media",
		"EditMediaPage",
		{ buildExclude: true }
	),
	"edit-channel": mediacmsDefaultPagesStatic(
		"edit-channel",
		"Edit channel",
		"EditChannelPage",
		{
			buildExclude: true,
			html: {
				body: {
					snippet: staticTemplates.editChannelPage(),
				},
			},
			render: templates.renderBase(),
		}
	),
	"edit-profile": mediacmsDefaultPagesStatic(
		"edit-profile",
		"Edit profile",
		"EditProfilePage",
		{
			buildExclude: true,
			html: {
				body: {
					snippet: staticTemplates.editProfilePage(),
				},
			},
			render: templates.renderBase(),
		}
	),
	signin: mediacmsDefaultPagesStatic("signin", "Sign in", "SigninPage", {
		buildExclude: true,
		html: {
			body: {
				snippet: staticTemplates.signinPage(),
			},
		},
		render: templates.renderBase(),
	}),
	signout: mediacmsDefaultPagesStatic("signout", "Sign out", "SignoutPage", {
		buildExclude: true,
		html: {
			body: {
				snippet: staticTemplates.signoutPage(),
			},
		},
		render: templates.renderBase(),
	}),
	register: mediacmsDefaultPagesStatic("register", "Register", "RegisterPage", {
		buildExclude: true,
		html: {
			body: {
				snippet: staticTemplates.registerPage(),
			},
		},
		render: templates.renderBase(),
	}),
	"reset-password": mediacmsDefaultPagesStatic(
		"reset-password",
		"Reset password",
		"ResetPasswordPage",
		{
			buildExclude: true,
			html: {
				body: {
					snippet: staticTemplates.resetPasswordPage(),
				},
			},
			render: templates.renderBase(),
		}
	),
	contact: mediacmsDefaultPagesStatic("contact", "Contact us", "ContactPage", {
		buildExclude: true,
		html: {
			body: {
				snippet: staticTemplates.contactPage(),
			},
		},
		render: templates.renderBase(),
	}),
	theme: mediacmsDefaultPagesStatic("theme", "Theme", "ThemePage", {
		buildExclude: true,
	}),
};

module.exports = {
	templates,
	pages,
	mediacmsDefaultPages,
	mediacmsDefaultPagesStatic,
	mediacmsDefaultPagesCustomRender,
	mediacmsTaxonomyPages,
	mediacmsManagementPages,
};
