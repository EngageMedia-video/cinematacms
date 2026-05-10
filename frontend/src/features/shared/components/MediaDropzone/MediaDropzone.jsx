import { useId, useRef, useState } from 'react';
import { Button } from '../Button';
import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

function fileListToArray(fileList) {
	return fileList ? Array.from(fileList) : [];
}

export function MediaDropzone({
	className = '',
	accept,
	multiple = true,
	disabled = false,
	iconName = 'upload',
	buttonIconName = 'uploadSmall',
	label = 'Drag & Drop Files(s) or',
	buttonLabel = 'CHOOSE MEDIA',
	onFilesSelected,
	inputId,
	'aria-label': ariaLabel = 'Choose media files',
}) {
	const generatedInputId = useId();
	const resolvedInputId = inputId ?? generatedInputId;
	const inputRef = useRef(null);
	const dragDepthRef = useRef(0);
	const [isDragging, setIsDragging] = useState(false);
	const [isDropAnimating, setIsDropAnimating] = useState(false);

	function emitFiles(files) {
		onFilesSelected?.(files);
	}

	function openPicker() {
		if (disabled) {
			return;
		}

		inputRef.current?.click();
	}

	function handleDragEnter(event) {
		event.preventDefault();
		if (disabled) {
			return;
		}

		dragDepthRef.current += 1;
		setIsDragging(true);
	}

	function handleDragOver(event) {
		event.preventDefault();
		if (disabled) {
			return;
		}

		event.dataTransfer.dropEffect = 'copy';
		setIsDragging(true);
	}

	function handleDragLeave(event) {
		event.preventDefault();
		if (disabled) {
			return;
		}

		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDragging(false);
		}
	}

	function handleDrop(event) {
		event.preventDefault();
		if (disabled) {
			return;
		}

		dragDepthRef.current = 0;
		setIsDragging(false);
		setIsDropAnimating(true);
		emitFiles(fileListToArray(event.dataTransfer.files));
		window.setTimeout(() => setIsDropAnimating(false), 220);
	}

	return (
		<div
			className={joinClasses(
				'relative w-full rounded-[16px] bg-cinemata-pacific-deep-800 px-6 py-[60px] transition-transform duration-200',
				isDragging ? 'scale-[1.01]' : '',
				isDropAnimating ? 'scale-[0.995]' : '',
				disabled ? 'opacity-60' : '',
				className
			)}
			data-dragging={isDragging ? 'true' : 'false'}
			data-dropzone
			onDragEnter={handleDragEnter}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			<input
				id={resolvedInputId}
				ref={inputRef}
				type="file"
				accept={accept}
				multiple={multiple}
				disabled={disabled}
				aria-label={ariaLabel}
				className="sr-only"
				onChange={(event) => {
					emitFiles(fileListToArray(event.target.files));
					event.target.value = '';
				}}
			/>

			<svg aria-hidden="true" data-dropzone-border className="pointer-events-none absolute inset-0 h-full w-full">
				<rect
					x="0.5"
					y="0.5"
					width="calc(100% - 1px)"
					height="calc(100% - 1px)"
					rx="16"
					ry="16"
					fill="none"
					className="stroke-cinemata-strait-blue-300"
					strokeWidth="1"
					strokeDasharray="8 8"
				/>
			</svg>

			<div className="relative z-10 flex flex-col items-center gap-4 text-center">
				{iconName ? (
					<div
						className={joinClasses(
							'text-cinemata-strait-blue-50 transition-transform duration-200',
							isDragging ? '-translate-y-1 scale-105' : '',
							isDropAnimating ? 'translate-y-0 scale-95' : ''
						)}
					>
						<Icon name={iconName} size={58} decorative data-dropzone-icon />
					</div>
				) : null}

				<p className="body-body-16-regular m-0 p-0 text-cinemata-strait-blue-50">{label}</p>

				<Button
					type="button"
					onClick={openPicker}
					disabled={disabled}
					icon={<Icon name={buttonIconName} size={20} decorative />}
				>
					{buttonLabel}
				</Button>
			</div>
		</div>
	);
}
