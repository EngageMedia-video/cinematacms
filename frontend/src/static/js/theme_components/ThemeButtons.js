import React from 'react';

export function ThemeButtons() {
	function group_buttons(group_classname) {
		group_classname = !!!group_classname ? '' : group_classname + ' ';

		const ret = [];
		const button_styles = [
			'default',
			'brand',
			'light',
			'light-accent',
			'dark-accent',
			'dark',
			'success',
			'warning',
			'danger',
			'disabled',
			'unstyled',
		];

		let btn_attr;
		let btn_classname;

		let i = 0;

		ret.push(<br key={group_classname + '[linebreak]'} />);

		while (i < button_styles.length) {
			btn_attr = {};

			switch (button_styles[i]) {
				case 'disabled':
					btn_attr.className = group_classname;
					btn_attr.disabled = true;
					break;
				case 'default':
					btn_attr.className = group_classname;
					break;
				default:
					btn_attr.className = group_classname + button_styles[i] + '-btn';
			}

			ret.push(
				<button key={group_classname + '[' + i + ']'} {...btn_attr}>
					Button
				</button>
			);

			i += 1;
		}

		return ret;
	}

	function default_buttons() {
		return group_buttons('');
	}

	function default_outline_buttons() {
		return group_buttons('outline-btn');
	}

	function small_buttons() {
		return group_buttons('small-btn');
	}

	function small_outline_buttons() {
		return group_buttons('small-btn outline-btn');
	}

	function large_buttons() {
		return group_buttons('large-btn');
	}

	function large_outline_buttons() {
		return group_buttons('large-btn outline-btn');
	}

	return (
		<div>
			<h2>Buttons</h2>

			<hr />
			<hr />

			{/*small_buttons()*/}
			{/*<br/>*/}
			{/*small_outline_buttons()*/}
			{/*<br/>*/}
			{default_buttons()}
			<br />
			{/*default_outline_buttons()*/}
			{/*<br/>*/}
			{/*large_buttons()*/}
			{/*<br/>*/}
			{/*large_outline_buttons()*/}
			{/*<br/>*/}

			<hr />
			<hr />
		</div>
	);
}
