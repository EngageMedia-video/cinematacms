import React, { useContext, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import LinksContext from '../../../../static/js/contexts/LinksContext';

import * as PageActions from '../../../../static/js/pages/_PageActions.js';
import PageStore from '../../../../static/js/pages/_PageStore.js';
import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';

import { Button } from '../../../shared/components/Button/Button';
import { CheckboxButton } from '../../../shared/components/CheckboxButton/CheckboxButton';
import { Icon } from '../../../shared/components/Icon/Icon';
import { Text } from '../../../shared/components/Text/Text';

const ASPECT_RATIO_OPTIONS = [
	{ group: 'Horizontal orientation', items: ['16:9', '4:3', '3:2'] },
	{ group: 'Vertical orientation', items: ['9:16', '3:4', '2:3'] },
];

const UNIT_BOTH = [
	{ key: 'px', label: 'px' },
	{ key: 'percent', label: '%' },
];
const UNIT_PX = [{ key: 'px', label: 'px' }];

function buildEmbedCode({ embedUrl, mediaId, width, widthUnit, height, heightUnit, startAt }) {
	const w = widthUnit === 'percent' ? `${width}%` : width;
	const h = heightUnit === 'percent' ? `${height}%` : height;
	const src = startAt > 0 ? `${embedUrl}${mediaId}&t=${startAt}` : `${embedUrl}${mediaId}`;
	return `<iframe width="${w}" height="${h}" src="${src}" frameborder="0" allowfullscreen></iframe>`;
}

function DimensionInput({ label, value, unit, units, onValueChange, onUnitChange }) {
	return (
		<label className="flex items-center gap-size-8">
			<span className="body-body-14-medium w-[60px] text-text-strong">{label}</span>

			<input
				type="number"
				min={1}
				max={99999}
				value={value}
				onChange={(event) => onValueChange(event.target.value)}
				className="body-body-14-regular w-[110px] rounded-ds-4 border border-border-strong-constant bg-bg-surface px-size-8 py-size-8 text-text-strong outline-none focus:border-border-input focus:ring-0"
			/>

			<select
				value={unit}
				onChange={(event) => onUnitChange(event.target.value)}
				className="body-body-14-regular rounded-ds-4 border border-border-strong-constant bg-bg-surface py-size-8 text-text-strong outline-none focus:border-border-input focus:ring-0"
			>
				{units.map((u) => (
					<option key={u.key} value={u.key}>
						{u.label}
					</option>
				))}
			</select>
		</label>
	);
}

DimensionInput.propTypes = {
	label: PropTypes.string.isRequired,
	value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
	unit: PropTypes.string.isRequired,
	units: PropTypes.array.isRequired,
	onValueChange: PropTypes.func.isRequired,
	onUnitChange: PropTypes.func.isRequired,
};

export function MediaShareEmbed({ triggerPopupClose, startAt = 0 }) {
	const links = useContext(LinksContext);
	const textareaRef = useRef(null);

	const embedDims = PageStore.get('config-options').embedded.video.dimensions;
	const mediaId = MediaPageStore.get('media-id');

	const [keepAspectRatio, setKeepAspectRatio] = useState(false);
	const [aspectRatio, setAspectRatio] = useState('16:9');
	const [widthValue, setWidthValue] = useState(embedDims.width);
	const [widthUnit, setWidthUnit] = useState(embedDims.widthUnit);
	const [heightValue, setHeightValue] = useState(embedDims.height);
	const [heightUnit, setHeightUnit] = useState(embedDims.heightUnit);

	const unitOptions = keepAspectRatio ? UNIT_PX : UNIT_BOTH;

	function applyRatio(width, height, ratio = aspectRatio, lockHeight = false) {
		const [x, y] = ratio.split(':').map(Number);
		if (lockHeight) {
			return { width: Math.trunc((height * x) / y), height };
		}
		return { width, height: Math.trunc((width * y) / x) };
	}

	function onWidthChange(newVal) {
		const value = newVal === '' ? 0 : Number(newVal);
		setWidthValue(value);
		if (keepAspectRatio) {
			const next = applyRatio(value, heightValue);
			setHeightValue(next.height);
		}
	}

	function onHeightChange(newVal) {
		const value = newVal === '' ? 0 : Number(newVal);
		setHeightValue(value);
		if (keepAspectRatio) {
			const next = applyRatio(widthValue, value, aspectRatio, true);
			setWidthValue(next.width);
		}
	}

	function onToggleKeepAspectRatio() {
		const next = !keepAspectRatio;
		setKeepAspectRatio(next);
		if (next) {
			setWidthUnit('px');
			setHeightUnit('px');
			const updated = applyRatio(widthValue, heightValue);
			setHeightValue(updated.height);
		}
	}

	function onAspectRatioChange(event) {
		const newVal = event.target.value;
		setAspectRatio(newVal);
		if (keepAspectRatio) {
			const updated = applyRatio(widthValue, heightValue, newVal);
			setHeightValue(updated.height);
		}
	}

	function onCopy() {
		if (textareaRef.current) {
			MediaPageActions.copyEmbedMediaCode(textareaRef.current);
			PageActions.addNotification('Embed media code copied to clipboard', 'clipboardEmbedMediaCodeCopy');
		}
	}

	const embedCode = buildEmbedCode({
		embedUrl: links.embed,
		mediaId,
		width: widthValue,
		widthUnit,
		height: heightValue,
		heightUnit,
		startAt: Math.trunc(startAt),
	});

	return (
		<div className="flex w-full max-w-[560px] flex-col gap-size-16 p-size-20">
			<div className="flex items-center justify-between">
				<Text as="h2" variant="body-16-bold" className="text-text-strong">
					Embed Video
				</Text>

				<Button
					type="button"
					variant="icon"
					size="sm"
					aria-label="Close"
					onClick={triggerPopupClose}
					icon={<Icon name="close" decorative />}
				/>
			</div>

			<textarea
				ref={textareaRef}
				readOnly
				value={embedCode}
				rows={4}
				className="body-body-14-regular w-full resize-none rounded-ds-8 border border-border-strong-constant bg-bg-surface p-size-12 text-text-strong outline-none focus:border-border-input focus:ring-0"
			/>

			<div className="flex flex-col gap-size-12">
				<Text as="span" variant="body-14-bold" className="text-text-strong">
					Embed options
				</Text>

				<div className="flex flex-wrap items-center gap-size-12">
					<CheckboxButton checked={keepAspectRatio} onChange={onToggleKeepAspectRatio}>
						Keep aspect ratio
					</CheckboxButton>

					{keepAspectRatio && (
						<select
							value={aspectRatio}
							onChange={onAspectRatioChange}
							className="body-body-14-regular rounded-ds-4 border border-border-strong-constant bg-bg-surface px-size-8 py-size-8 text-text-strong outline-none focus:border-border-input focus:ring-0"
						>
							{ASPECT_RATIO_OPTIONS.map((group) => (
								<optgroup key={group.group} label={group.group}>
									{group.items.map((item) => (
										<option key={item} value={item}>
											{item}
										</option>
									))}
								</optgroup>
							))}
						</select>
					)}
				</div>

				<DimensionInput
					label="Width"
					value={widthValue}
					unit={widthUnit}
					units={unitOptions}
					onValueChange={onWidthChange}
					onUnitChange={setWidthUnit}
				/>

				<DimensionInput
					label="Height"
					value={heightValue}
					unit={heightUnit}
					units={unitOptions}
					onValueChange={onHeightChange}
					onUnitChange={setHeightUnit}
				/>
			</div>

			<div className="flex justify-end">
				<Button type="button" variant="primary" size="sm" onClick={onCopy}>
					Copy
				</Button>
			</div>
		</div>
	);
}

MediaShareEmbed.propTypes = {
	triggerPopupClose: PropTypes.func,
	startAt: PropTypes.number,
};
