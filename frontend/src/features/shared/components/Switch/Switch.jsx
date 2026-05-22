import { cn } from '../../utils/classNames';
import PropTypes from 'prop-types';
import { useState } from 'react';

export function Switch({
	checked,
	children,
	className = '',
	defaultChecked = false,
	disabled = false,
	name,
	onChange,
	readOnly = false,
	value,
	...props
}) {
	const isControlled = checked !== undefined;
	const [internalChecked, setInternalChecked] = useState(Boolean(defaultChecked));
	const resolvedChecked = isControlled ? checked : internalChecked;

	function handleChange(event) {
		if (!isControlled) {
			setInternalChecked(event.target.checked);
		}

		onChange?.(event);
	}

	return (
		<label
			className={cn(
				'inline-flex cursor-pointer items-center gap-[16px] select-none [--switch-padding:3px] [--switch-thumb-size:14px] [--switch-width:30px]',
				disabled && 'cursor-not-allowed opacity-60',
				className
			)}
		>
			{children && (
				<span className="body-body-16-regular text-cinemata-neutral-700 dark:text-cinemata-neutral-500">
					{children}
				</span>
			)}

			<input
				type="checkbox"
				className="peer sr-only"
				checked={isControlled ? checked : undefined}
				defaultChecked={!isControlled ? defaultChecked : undefined}
				disabled={disabled}
				name={name}
				readOnly={readOnly || (isControlled && !onChange)}
				value={value}
				onChange={handleChange}
				{...props}
			/>

			<span
				className={cn(
					'inline-flex h-[calc(var(--switch-thumb-size)+var(--switch-padding)*2)] w-[var(--switch-width)] shrink-0 items-center rounded-full p-[var(--switch-padding)] transition-colors duration-200',
					resolvedChecked ? 'justify-end' : 'justify-start'
				)}
				style={{
					backgroundColor: resolvedChecked
						? 'var(--cinemata-strait-blue-100)'
						: 'var(--cinemata-pacific-deep-900)',
				}}
				data-switch-track=""
				aria-hidden="true"
			>
				<span
					className="block size-[var(--switch-thumb-size)] rounded-full bg-cinemata-neutral-50 transition-transform duration-200 ease-out"
					data-switch-thumb=""
				/>
			</span>
		</label>
	);
}

Switch.propTypes = {
	checked: PropTypes.bool,
	children: PropTypes.node,
	className: PropTypes.string,
	defaultChecked: PropTypes.bool,
	disabled: PropTypes.bool,
	name: PropTypes.string,
	onChange: PropTypes.func,
	readOnly: PropTypes.bool,
	value: PropTypes.string,
};
