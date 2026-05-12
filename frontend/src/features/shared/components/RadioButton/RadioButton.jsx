import PropTypes from 'prop-types';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

export function RadioButton({
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

	return (
		<label
			className={joinClasses(
				'inline-flex cursor-pointer items-center gap-[8px] select-none',
				disabled && 'cursor-not-allowed opacity-60',
				className
			)}
		>
			<input
				type="radio"
				className="peer sr-only"
				checked={isControlled ? checked : undefined}
				defaultChecked={!isControlled ? defaultChecked : undefined}
				disabled={disabled}
				name={name}
				readOnly={readOnly || (isControlled && !onChange)}
				value={value}
				onChange={onChange}
				{...props}
			/>

			<span
				className={joinClasses(
					'inline-flex shrink-0 items-center justify-center rounded-full bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-900 transition-colors duration-200 peer-checked:bg-cinemata-sunset-horizon-400p'
				)}
				style={{ width: 18, height: 18, padding: 3 }}
				aria-hidden="true"
			>
				<span
					className="block rounded-full bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-900 transition-transform duration-200"
					style={{ width: 8, height: 8 }}
				/>
			</span>

			{children && (
				<span className="body-body-16-regular text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">
					{children}
				</span>
			)}
		</label>
	);
}

RadioButton.propTypes = {
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
