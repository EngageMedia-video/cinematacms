import { cn } from '../../utils/classNames';
import PropTypes from 'prop-types';

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
			className={cn(
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
				className={cn(
					'inline-flex shrink-0 items-center justify-center rounded-full bg-bg-control transition-colors duration-200 peer-checked:bg-bg-secondary'
				)}
				style={{ width: 18, height: 18, padding: 3 }}
				aria-hidden="true"
			>
				<span
					className="block rounded-full bg-bg-control transition-transform duration-200"
					style={{ width: 8, height: 8 }}
				/>
			</span>

			{children && <span className="body-body-16-regular text-text-strong">{children}</span>}
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
