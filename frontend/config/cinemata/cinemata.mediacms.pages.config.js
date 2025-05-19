const fs = require("fs");
const path = require("path");

const ejs = require("ejs");
const merge = require("lodash.merge");

const mediacmsPages = require("../__default/mediacms.pages.config.js").pages;
const mediacmsTemplates =
	require("../__default/mediacms.pages.config.js").templates;
const mediacmsDefaultPages =
	require("../__default/mediacms.pages.config.js").mediacmsDefaultPages;
const mediacmsDefaultPagesStatic =
	require("../__default/mediacms.pages.config.js").mediacmsDefaultPagesStatic;
const mediacmsDefaultPagesCustomRender =
	require("../__default/mediacms.pages.config.js").mediacmsDefaultPagesCustomRender;
const mediacmsTaxonomyPages =
	require("../__default/mediacms.pages.config.js").mediacmsTaxonomyPages;

const staticTemplatesPath = path.join(
	__dirname,
	"../templates/static/cinemata"
);

const staticTemplates = {
	aboutPage: ejs.compile(
		fs.readFileSync(path.join(staticTemplatesPath, "aboutPage.html"), "utf8"),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "aboutPage.html"),
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
	editorialPolicyPage: ejs.compile(
		fs.readFileSync(
			path.join(staticTemplatesPath, "editorialPolicyPage.html"),
			"utf8"
		),
		{
			root: [staticTemplatesPath],
			filename: path.join(staticTemplatesPath, "editorialPolicyPage.html"),
			outputFunctionName: "echo",
		}
	),
};

const pages = {};

const excludePages = [
	// "playlist",
	// "profile-playlists",
	"profile-media",
	"terms",
];

// Set testing playlist id.
mediacmsPages.playlist.window.MediaCMS.playlistId = "BJB9jxFpw";

for (p in mediacmsPages) {
	if (-1 === excludePages.indexOf(p)) {
		pages[p] = mediacmsPages[p];
	}
}

// Override home page.
pages.index = mediacmsDefaultPages(
	"home",
	"Home",
	"HomeSingleFeaturedPage",
	{}
);

// Override embedded player page.
pages.embed = merge(
	{},
	mediacmsDefaultPagesCustomRender(
		"embed",
		"Embedded player",
		mediacmsTemplates.renderEmbedPageContent({
			page: { id: "page-embed", component: "EmbedPage" },
		}),
		{ window: { MediaCMS: { mediaId: "Dn96StHHp" } } }
	),
	{
		html: {
			body: {
				snippet: mediacmsTemplates.htmlBodySnippetEmbedPage({ id: "page-embed" }),
			},
		},
	}
);

// Override media pages.
pages.media = mediacmsDefaultPagesCustomRender(
	"media",
	"Media",
	mediacmsTemplates.renderMediaPageContent({
		page: { id: "page-media", component: "MediaPage", componentFile: "index" },
	}),
	{ window: { MediaCMS: { mediaId: "ncvOS2PDw" } } }
);

pages["media-video"] = mediacmsDefaultPagesCustomRender(
	"media-video",
	"Media - Video",
	mediacmsTemplates.renderMediaPageContent({
		page: {
			id: "page-media-video",
			component: "MediaPageVideo",
			componentFile: "Video",
		},
	}),
	{ buildExclude: true, window: { MediaCMS: { mediaId: "ncvOS2PDw" } } }
);

pages["media-audio"] = mediacmsDefaultPagesCustomRender(
	"media-audio",
	"Media - Audio",
	mediacmsTemplates.renderMediaPageContent({
		page: {
			id: "page-media-audio",
			component: "MediaPageAudio",
			componentFile: "Audio",
		},
	}),
	{ buildExclude: true, window: { MediaCMS: { mediaId: "ncvOS2PDw" } } }
);

pages["media-image"] = mediacmsDefaultPagesCustomRender(
	"media-image",
	"Media - Image",
	mediacmsTemplates.renderMediaPageContent({
		page: {
			id: "page-media-image",
			component: "MediaPageImage",
			componentFile: "Image",
		},
	}),
	{ buildExclude: true, window: { MediaCMS: { mediaId: "ncvOS2PDw" } } }
);

/*pages['media-pdf'] = mediacmsDefaultPagesCustomRender(
    'media-pdf',
    'mediacmsTemplates - Pdf',
    templates.renderMediaPageContent( { page: { id: 'page-media-pdf', component: 'MediaPagePdf', componentFile: 'Pdf' } } ),
    { buildExclude: true, window: { MediaCMS: { "mediaId": "ncvOS2PDw" } } },
);*/

pages["playlist"].buildExclude = false;
pages["profile-playlists"].buildExclude = false;

// Taxonomy pages.
pages.tags = mediacmsTaxonomyPages(
	"tags",
	"Tags - Cinemata - MediaCMS",
	"TagsPageAlt",
	{}
);

pages.categories = mediacmsTaxonomyPages(
	"categories",
	"Categories - Cinemata - MediaCMS",
	"CategoriesPageAlt",
	{}
);

pages.topics = mediacmsTaxonomyPages(
	"topics",
	"Topics - Cinemata - MediaCMS",
	"TopicsPageAlt",
	{}
);

pages.languages = mediacmsTaxonomyPages(
	"languages",
	"Tags - Cinemata - MediaCMS",
	"LanguagesPageAlt",
	{}
);

pages.countries = mediacmsTaxonomyPages(
	"countries",
	"Countries - Cinemata - MediaCMS",
	"CountriesPageAlt",
	{}
);

// Static pages.

pages.about.html.body.snippet = staticTemplates.aboutPage();
pages.about.buildExclude = true;

pages.contact.html.body.snippet = staticTemplates.contactPage();
pages.contact.buildExclude = true;

pages["editorial-policy"] = mediacmsDefaultPagesStatic(
	"editorial-policy",
	"Editorial policy",
	void 0,
	{
		html: {
			body: {
				snippet: staticTemplates.editorialPolicyPage(),
			},
		},
		render: mediacmsTemplates.renderBase(),
		buildExclude: true,
	}
);

// Register our Demo page
pages.demo = mediacmsDefaultPages(
	"demo",
	"Demo Page - Cinemata",
	"DemoPage",
	{
		// Optional additional window.MediaCMS configuration
		window: {
			MediaCMS: {
				demoOptions: {
					defaultCounterValue: 0,
					maxCounters: 5
				}
			}
		}
	}
);

module.exports = {
	pages,
};
