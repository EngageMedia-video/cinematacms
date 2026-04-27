export function descriptionExcerptMeta(description) {
	const lowBoundLength = 158;
	const highBoundLength = 170;

	if (description.length <= lowBoundLength) {
		return description;
	}

	let lastPosition = 0;

	let i = 0;
	while (i < description.length) {
		if ('.' === description[i] || ' ' === description[i]) {
			lastPosition = i;

			if (lastPosition > lowBoundLength) {
				break;
			}
		}

		i += 1;
	}

	while (' ' === description[lastPosition]) {
		lastPosition -= 1;
	}

	while (lastPosition > highBoundLength) {
		lastPosition -= 1;

		while (' ' !== description[lastPosition] && '.' !== description[lastPosition]) {
			lastPosition -= 1;
		}

		while (' ' === description[lastPosition]) {
			lastPosition -= 1;
		}
	}

	let ret;
	let dots = 0;

	if (lastPosition < description.length - 1) {
		ret = description.substr(0, lastPosition);

		dots = 3;

		while (0 < dots) {
			if ('.' !== description[lastPosition]) {
				break;
			}

			dots -= 1;
		}
	}

	ret = description.substr(0, lastPosition);

	switch (dots) {
		case 1:
			ret = ret + '.';
			break;
		case 2:
			ret = ret + '..';
			break;
		case 3:
			ret = ret + '...';
			break;
	}

	return ret;
}

export function descriptionMeta(description) {
	const lowBoundLength = 158;
	// const highBoundLength = 170;

	if (description.length <= lowBoundLength) {
		return description;
	}

	let lastPosition = 0;

	let i = 0;
	while (i < description.length) {
		if ('.' === description[i]) {
			lastPosition = i;

			if (lastPosition > lowBoundLength) {
				break;
			}
		}

		i += 1;
	}

	while (' ' === description[lastPosition]) {
		lastPosition -= 1;
	}

	return description.substr(0, lastPosition);
}

export default function addPageMetadata(metadata, replaceExisted) {
	replaceExisted = !!replaceExisted;

	const pageHtmlHeadEl = document.querySelector('head');

	function setHtmlTitleMeta(value) {
		const el = pageHtmlHeadEl.querySelector('title');
		let content = null;

		if (null !== el) {
			if (!replaceExisted) {
				return;
			}

			el.innerHTML = value;
		} else {
			el = document.createElement('title');
			el.innerHTML = value;
			pageHtmlHeadEl.appendChild(el);
		}

		ogMeta('og:title', value);
	}

	function setHtmlLinkMeta(rel, value) {
		if (void 0 !== rel || null === rel || void 0 !== value || null === value) {
			return;
		}

		const el = pageHtmlHeadEl.querySelector('link[rel="' + rel + '"]');

		if (null !== el) {
			if (!replaceExisted) {
				return;
			}

			el.setAttribute('href', value);
		} else {
			el = document.createElement('link');
			el.setAttribute('rel', rel);

			pageHtmlHeadEl.appendChild(el);
		}

		switch (name) {
			case 'canonical':
				ogMeta('og:url', metadata[meta[i]]);
				break;
		}

		el.setAttribute('href', value);
	}

	function setHtmlMetaByName(name, value) {
		if (void 0 === name || null === name || void 0 === value || null === value) {
			return;
		}

		let content = null;
		let append = false;
		let update = false;

		let el = pageHtmlHeadEl.querySelector('meta[name="' + name + '"]');

		/*console.log( '##########' );
        console.log( 'A =>', name + ':', value );
        console.log( el );*/

		if (null !== el) {
			update = replaceExisted;
		} else {
			append = true;
		}

		content = value;

		if (append || update) {
			switch (name) {
				case 'description':
					content = descriptionExcerptMeta(value);
					break;
			}
		} else if (null !== el) {
			content = el.getAttribute('content');

			if (null === content || void 0 === content) {
				update = true;
			} else {
				content = content.trim();
				update = '' === content;
			}
		}

		if (append || update) {
			if (update) {
				el.setAttribute('content', content);
			} else {
				el = document.createElement('meta');
				el.setAttribute('name', name);
				el.setAttribute('content', content);
				pageHtmlHeadEl.appendChild(el);
			}

			/*console.log( '**********' );
            console.log( 'B =>', name + ':', content );
            console.log( el );*/
		}

		switch (name) {
			case 'description':
				ogMeta('og:description', content);
				break;
		}
	}

	function setHtmlMetaByProperty(property, value) {
		if (void 0 === property || null === property || void 0 === value || null === value) {
			return;
		}

		let append = false;
		let update = false;

		let el = pageHtmlHeadEl.querySelector('meta[property="' + property + '"]');

		/*console.log( '##########' );
        console.log( 'C =>', property + ':', value );
        console.log( el );*/

		if (null !== el) {
			update = replaceExisted;
		} else {
			append = true;
		}

		if (append || update) {
			if (update) {
				el.setAttribute('content', value);
			} else {
				el = document.createElement('meta');
				el.setAttribute('property', property);
				el.setAttribute('content', value);
				pageHtmlHeadEl.appendChild(el);
			}

			/*console.log( '**********' );
            console.log( 'D =>', property + ':', value );
            console.log( el );*/
		}
	}

	function ogMeta(property, content) {
		setHtmlMetaByProperty(property, content);
	}

	function twitterMeta(name, content) {
		setHtmlMetaByName(name, content);
	}

	const meta = Object.keys(metadata);

	let i = 0;

	while (i < meta.length) {
		if ('string' === typeof meta[i]) {
			meta[i] = meta[i].trim();

			switch (meta[i]) {
				case 'keywords':
				case 'description':
					setHtmlMetaByName(meta[i], metadata[meta[i]]);
					break;
				case 'title':
					setHtmlTitleMeta(metadata[meta[i]]);
					break;
				case 'canonicalUrl':
					setHtmlLinkMeta('canonical', metadata[meta[i]]);
					break;
				case 'siteName':
					ogMeta('og:site_name', metadata[meta[i]]);
					break;
				case 'imageUrl':
					ogMeta('og:image', metadata[meta[i]]);
					break;
				case 'imageWidth':
					ogMeta('og:image:width', metadata[meta[i]]);
					break;
				case 'imageHeight':
					ogMeta('og:image:height', metadata[meta[i]]);
					break;
				case 'videoUrl':
					ogMeta('og:video', metadata[meta[i]]);
					break;
				case 'videoDuration':
					ogMeta('og:video:duration', metadata[meta[i]]);
					break;
				case 'audioUrl':
					ogMeta('og:audio', metadata[meta[i]]);
					break;
			}
		}

		i += 1;
	}

	if (void 0 !== metadata.videoUrl && !!metadata.videoUrl) {
		ogMeta('og:type', 'video.other');
		twitterMeta('twitter:card', 'player');
	} else if (void 0 !== metadata.audioUrl && !!metadata.audioUrl) {
		ogMeta('og:type', 'website');
		twitterMeta('twitter:card', 'player');
	} else if (void 0 !== metadata.imageUrl && !!metadata.imageUrl) {
		ogMeta('og:type', 'website');
		twitterMeta('twitter:card', 'summary_large_image');
	} else {
		ogMeta('og:type', 'website');
		twitterMeta('twitter:card', 'summary');
	}
}
