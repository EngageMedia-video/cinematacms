let CONTENTS = null;

function headerContents(contents) {
	const ret = {
		right: '',
		onLogoRight: '',
	};

	if (void 0 !== contents) {
		if ('string' === typeof contents.right) {
			ret.right = contents.right.trim();
		}

		if ('string' === typeof contents.onLogoRight) {
			ret.onLogoRight = contents.onLogoRight.trim();
		}
	}

	return ret;
}

function sidebarContents(contents) {
	const ret = {
		navMenu: {
			items: [],
		},
		navMenuNew: {
			items: [],
		},
		mainMenuExtra: {
			items: [],
		},
		mainMenuExtraNew: {
			items: [],
		},
		belowNavMenu: '',
		belowNavMenuNew: '',
		belowThemeSwitcher: '',
		footer: '',
		footerNew: {
			logo: null,
			links: [],
		},
	};

	if (undefined !== contents) {
		if (undefined !== contents.mainMenuExtraItems) {
			let i = 0;
			while (i < contents.mainMenuExtraItems.length) {
				if (
					'string' === typeof contents.mainMenuExtraItems[i].text &&
					'string' === typeof contents.mainMenuExtraItems[i].link &&
					'string' === typeof contents.mainMenuExtraItems[i].icon
				) {
					ret.mainMenuExtra.items.push({
						text: contents.mainMenuExtraItems[i].text,
						link: contents.mainMenuExtraItems[i].link,
						icon: contents.mainMenuExtraItems[i].icon,
						className: contents.mainMenuExtraItems[i].className,
					});
				}

				i += 1;
			}
		}

		if (undefined !== contents.mainMenuExtraNewItems) {
			let i = 0;
			while (i < contents.mainMenuExtraNewItems.length) {
				if (
					'string' === typeof contents.mainMenuExtraNewItems[i].text &&
					'string' === typeof contents.mainMenuExtraNewItems[i].link &&
					'string' === typeof contents.mainMenuExtraNewItems[i].icon
				) {
					ret.mainMenuExtraNew.items.push({
						text: contents.mainMenuExtraNewItems[i].text,
						link: contents.mainMenuExtraNewItems[i].link,
						icon: contents.mainMenuExtraNewItems[i].icon,
						className: contents.mainMenuExtraNewItems[i].className,
					});
				}

				i += 1;
			}
		}

		if (undefined !== contents.navMenuItems) {
			let i = 0;
			while (i < contents.navMenuItems.length) {
				if (
					'string' === typeof contents.navMenuItems[i].text &&
					'string' === typeof contents.navMenuItems[i].link &&
					'string' === typeof contents.navMenuItems[i].icon
				) {
					ret.navMenu.items.push({
						text: contents.navMenuItems[i].text,
						link: contents.navMenuItems[i].link,
						icon: contents.navMenuItems[i].icon,
						className: contents.navMenuItems[i].className,
					});
				}

				i += 1;
			}
		}

		if (undefined !== contents.navMenuItemsNew) {
			let i = 0;
			while (i < contents.navMenuItemsNew.length) {
				if (
					'string' === typeof contents.navMenuItemsNew[i].text &&
					'string' === typeof contents.navMenuItemsNew[i].link &&
					'string' === typeof contents.navMenuItemsNew[i].icon
				) {
					ret.navMenuNew.items.push({
						text: contents.navMenuItemsNew[i].text,
						link: contents.navMenuItemsNew[i].link,
						icon: contents.navMenuItemsNew[i].icon,
						className: contents.navMenuItemsNew[i].className,
					});
				}

				i += 1;
			}
		}

		if (undefined !== contents.footerNew) {
			if (
				undefined !== contents.footerNew.logo &&
				'string' === typeof contents.footerNew.logo.link &&
				'string' === typeof contents.footerNew.logo.title &&
				'string' === typeof contents.footerNew.logo.darkImage &&
				'string' === typeof contents.footerNew.logo.lightImage
			) {
				ret.footerNew.logo = {
					link: contents.footerNew.logo.link,
					title: contents.footerNew.logo.title,
					darkImage: contents.footerNew.logo.darkImage,
					lightImage: contents.footerNew.logo.lightImage,
					target: contents.footerNew.logo.target,
					rel: contents.footerNew.logo.rel,
				};
			}

			if (undefined !== contents.footerNew.links) {
				let i = 0;
				while (i < contents.footerNew.links.length) {
					if (
						'string' === typeof contents.footerNew.links[i].text &&
						'string' === typeof contents.footerNew.links[i].link
					) {
						ret.footerNew.links.push({
							text: contents.footerNew.links[i].text,
							link: contents.footerNew.links[i].link,
							target: contents.footerNew.links[i].target,
							rel: contents.footerNew.links[i].rel,
						});
					}

					i += 1;
				}
			}
		}

		if ('string' === typeof contents.belowNavMenu) {
			ret.belowNavMenu = contents.belowNavMenu.trim();
		}

		if ('string' === typeof contents.belowNavMenuNew) {
			ret.belowNavMenuNew = contents.belowNavMenuNew.trim();
		}

		if ('string' === typeof contents.belowThemeSwitcher) {
			ret.belowThemeSwitcher = contents.belowThemeSwitcher.trim();
		}

		if ('string' === typeof contents.footer) {
			ret.footer = contents.footer.trim();
		}
	}

	return ret;
}

function uploaderContents(contents) {
	const ret = {
		belowUploadArea: '',
		postUploadMessage: '',
	};

	if (void 0 !== contents) {
		if ('string' === typeof contents.belowUploadArea) {
			ret.belowUploadArea = contents.belowUploadArea.trim();
		}

		if ('string' === typeof contents.postUploadMessage) {
			ret.postUploadMessage = contents.postUploadMessage.trim();
		}
	}

	return ret;
}

export function init(contents) {
	CONTENTS = {
		header: headerContents(contents.header),
		sidebar: sidebarContents(contents.sidebar),
		uploader: uploaderContents(contents.uploader),
	};
}

export function settings() {
	return CONTENTS;
}
