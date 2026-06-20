import { cn } from '../../utils/classNames';
import PropTypes from 'prop-types';
import { Icon } from '../Icon';

export function CheckboxButton({
	checked,
	children,
	className = '',
	controlClassName = '',
	controlStyle,
	defaultChecked = false,
	disabled = false,
	iconName = 'checklist',
	labelClassName = '',
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
				type="checkbox"
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
					'inline-flex shrink-0 items-center justify-center bg-border-subtle text-transparent transition-colors duration-200 peer-checked:bg-bg-control-checked peer-checked:text-text-inverse peer-checked:[&_.svg-icon]:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-ring-focus peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-surface',
					controlClassName
				)}
				style={{ width: 18, height: 18, ...controlStyle }}
				aria-hidden="true"
			>
				<Icon name={iconName} decorative size={14} className="opacity-0 transition-opacity duration-200" />
			</span>

			{children && (
				<span className={cn('body-body-16-regular text-text-strong', labelClassName)}>{children}</span>
			)}
		</label>
	);
}

CheckboxButton.propTypes = {
	checked: PropTypes.bool,
	children: PropTypes.node,
	className: PropTypes.string,
	controlClassName: PropTypes.string,
	controlStyle: PropTypes.object,
	defaultChecked: PropTypes.bool,
	disabled: PropTypes.bool,
	iconName: PropTypes.string,
	labelClassName: PropTypes.string,
	name: PropTypes.string,
	onChange: PropTypes.func,
	readOnly: PropTypes.bool,
	value: PropTypes.string,
};
