import React from 'react';
import PropTypes from 'prop-types';
import { getIconComponent } from './iconRegistry';

const warnedIcons = new Set();

const ICON_SIZES = {
	xs: 16,
	sm: 18,
	md: 24,
	lg: 32,
	xl: 40,
};

function resolveSize(size) {
	if ('number' === typeof size && Number.isFinite(size)) {
		return size;
	}

	return ICON_SIZES[size] || ICON_SIZES.md;
}

function warnMissingIcon(name) {
	if (!import.meta.env.DEV || warnedIcons.has(name)) {
		return;
	}

	warnedIcons.add(name);
	console.warn(`[Icon] Unknown icon "${name}". Add it to src/features/shared/components/iconRegistry.js.`);
}

export function Icon(props) {
	const { name, size = 'md', className = '', label, title, decorative, style, ...restProps } = props;
	const SvgIcon = getIconComponent(name);

	if (!SvgIcon) {
		warnMissingIcon(name);
		return null;
	}

	const resolvedSize = resolveSize(size);
	const isDecorative = 'boolean' === typeof decorative ? decorative : !(label || title);
	const resolvedClassName = ['svg-icon', className].filter(Boolean).join(' ');

	return (
		<SvgIcon
			{...restProps}
			data-icon={name}
			className={resolvedClassName}
			role={isDecorative ? undefined : 'img'}
			aria-hidden={isDecorative ? 'true' : undefined}
			aria-label={isDecorative ? undefined : label}
			title={isDecorative ? undefined : title}
			focusable="false"
			style={{
				width: resolvedSize,
				height: resolvedSize,
				display: 'block',
				flexShrink: 0,
				...style,
			}}
		/>
	);
}

Icon.propTypes = {
	name: PropTypes.string.isRequired,
	size: PropTypes.oneOfType([PropTypes.oneOf(Object.keys(ICON_SIZES)), PropTypes.number]),
	className: PropTypes.string,
	label: PropTypes.string,
	title: PropTypes.string,
	decorative: PropTypes.bool,
	style: PropTypes.object,
};
