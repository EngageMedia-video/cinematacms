import React from 'react';
import PropTypes from 'prop-types';

export function ThemeFormControls() {
	return (
		<div>
			<h2>Form controls</h2>

			<hr />

			<h3>Input fields</h3>

			<hr />

			<label>Text input</label>
			<input type="text" placeholder="Text" />

			<label>Text input label (disabled)</label>
			<input type="text" placeholder="Text" disabled />

			<label>Success text input</label>
			<span className="input-message success-message">Text input success message</span>
			<input type="text" className="input-success" placeholder="Success text" />

			<label>Warning text input</label>
			<span className="input-message warning-message">Text input warning message</span>
			<input type="text" className="input-warning" placeholder="Warning text" />

			<label>Error text input</label>
			<span className="input-message error-message">Text input error message</span>
			<input type="text" className="input-error" placeholder="Error text" />

			<label>Username input</label>
			<input type="text" name="username" placeholder="Username" />

			<label>Email input</label>
			<input type="email" placeholder="Email" />

			<label>Password input</label>
			<input type="password" placeholder="Password" />

			<label>Number input</label>
			<input type="number" placeholder="0" />

			<label>File</label>
			<input type="file" />

			<label>File</label>
			<input type="file" disabled />

			<label>Range input</label>
			<input type="range" min="0" max="100" step="5" defaultValue="35" />

			<label>Textarea</label>
			<textarea></textarea>

			<label>Textarea label (disabled)</label>
			<textarea disabled></textarea>

			<label>Dropbdown</label>
			<select>
				<option>-- Select --</option>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
				<option value="3">Option 3</option>
			</select>

			<label>Dropbdown label (disabled)</label>
			<select disabled>
				<option>-- Select --</option>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
				<option value="3">Option 3</option>
			</select>

			<label>Multiple selection</label>
			<select multiple={true}>
				<option>-- Select --</option>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
				<option value="3">Option 3</option>
			</select>

			<label>Multiple selection (disabled)</label>
			<select multiple={true} disabled>
				<option>-- Select --</option>
				<option value="1">Option 1</option>
				<option value="2">Option 2</option>
				<option value="3">Option 3</option>
			</select>

			<hr />

			<h3>Checkboxes & radios input fields</h3>

			<hr />

			<h4>Default inline</h4>

			<hr />

			<input type="checkbox" id="check_field_11" name="check_field_11" value="1" defaultChecked />
			<label htmlFor="check_field_11">Checkbox label (checked)</label>

			<input type="checkbox" id="check_field_12" name="check_field_12" value="2" />
			<label htmlFor="check_field_12">Checkbox</label>

			<input type="checkbox" id="check_field_13" name="check_field_13" value="3" />
			<label htmlFor="check_field_13"></label>

			<input type="checkbox" id="check_field_14" name="check_field_14" value="4" disabled />
			<label htmlFor="check_field_14">Checkbox label (disabled)</label>

			<input type="checkbox" id="check_field_15" name="check_field_15" value="5" defaultChecked disabled />
			<label htmlFor="check_field_15">Checkbox label (checked + disabled)</label>

			<hr />

			<hr />

			<input type="radio" id="radio_default_field_11" name="radio_default_field_B" value="1" defaultChecked />
			<label htmlFor="radio_default_field_11">Radio selection label (checked)</label>

			<input type="radio" id="radio_default_field_12" name="radio_default_field_B" value="2" />
			<label htmlFor="radio_default_field_12">Radio selection</label>

			<input type="radio" id="radio_default_field_13" name="radio_default_field_B" value="3" />
			<label htmlFor="radio_default_field_13"></label>

			<input type="radio" id="radio_default_field_14" name="radio_default_field_B" value="4" disabled />
			<label htmlFor="radio_default_field_14">Radio selection label (disabled)</label>

			<input
				type="radio"
				id="radio_default_field_15"
				name="radio_default_field_B"
				value="1"
				defaultChecked
				disabled
			/>
			<label htmlFor="radio_default_field_15">Radio selection label (checked + disabled)</label>

			<hr />

			<h4>Default nested inline</h4>

			<hr />

			<label>
				<input type="checkbox" defaultChecked />
				Checkbox label (checked)
			</label>
			<label>
				<input type="checkbox" />
				Checkbox
			</label>
			<label>
				<input type="checkbox" />
			</label>
			<label>
				<input type="checkbox" disabled />
				Checkbox label (disabled)
			</label>
			<label>
				<input type="checkbox" defaultChecked disabled />
				Checkbox label (checked + disabled)
			</label>

			<hr />

			<label>
				<input type="radio" name="radio_A" value="1 " defaultChecked />
				Checkbox label (checked)
			</label>
			<label>
				<input type="radio" name="radio_A" value="2" />
				Checkbox
			</label>
			<label>
				<input type="radio" name="radio_A" value="3" />
			</label>
			<label>
				<input type="radio" name="radio_A" value="4" disabled />
				Checkbox label (disabled)
			</label>
			<label>
				<input type="radio" name="radio_A" value="1" defaultChecked disabled />
				Checkbox label (checked + disabled)
			</label>

			<hr />

			<h4>Default nested list</h4>

			<hr />

			<label>
				<input type="checkbox" defaultChecked />
				Checkbox label (checked)
			</label>
			<br />
			<label>
				<input type="checkbox" />
				Checkbox
			</label>
			<br />
			<label>
				<input type="checkbox" />
			</label>
			<br />
			<label>
				<input type="checkbox" disabled />
				Checkbox label (disabled)
			</label>
			<br />
			<label>
				<input type="checkbox" defaultChecked disabled />
				Checkbox label (checked + disabled)
			</label>

			<hr />

			<label>
				Checkbox label (checked)
				<input type="checkbox" value="1 " defaultChecked />
			</label>
			<br />
			<label>
				Checkbox label
				<input type="checkbox" value="2" />
			</label>
			<br />
			<label>
				<input type="checkbox" value="3" />
			</label>
			<br />
			<label>
				Checkbox label (disabled)
				<input type="checkbox" value="4" disabled />
			</label>
			<br />
			<label>
				Checkbox label (checked + disabled)
				<input type="checkbox" value="1" defaultChecked disabled />
			</label>

			<hr />

			<label>
				<input type="radio" name="radio_B" value="1 " defaultChecked />
				Checkbox label (checked)
			</label>
			<br />
			<label>
				<input type="radio" name="radio_B" value="2" />
				Checkbox
			</label>
			<br />
			<label>
				<input type="radio" name="radio_B" value="3" />
			</label>
			<br />
			<label>
				<input type="radio" name="radio_B" value="4" disabled />
				Checkbox label (disabled)
			</label>
			<br />
			<label>
				<input type="radio" name="radio_B" value="4" defaultChecked disabled />
				Checkbox label (checked + disabled)
			</label>

			<hr />

			<label>
				Checkbox label (checked)
				<input type="radio" name="radio_C" value="1 " defaultChecked />
			</label>
			<br />
			<label>
				Checkbox label
				<input type="radio" name="radio_C" value="2" />
			</label>
			<br />
			<label>
				<input type="radio" name="radio_C" value="3" />
			</label>
			<br />
			<label>
				Checkbox label (disabled)
				<input type="radio" name="radio_C" value="4" disabled />
			</label>
			<br />
			<label>
				Checkbox label (checked + disabled)
				<input type="radio" name="radio_C" value="1" defaultChecked disabled />
			</label>

			<hr />

			<h4>Styled nested inline</h4>

			<hr />

			<label className="checkbox-label">
				<input type="checkbox" defaultChecked />
				<span className="selectbox"></span>Checkbox label (checked)
			</label>
			<label className="checkbox-label">
				<input type="checkbox" />
				<span className="selectbox"></span>Checkbox
			</label>
			<label className="checkbox-label">
				<input type="checkbox" />
				<span className="selectbox"></span>
			</label>
			<label className="checkbox-label">
				<input type="checkbox" disabled />
				<span className="selectbox"></span>Checkbox label (disabled)
			</label>
			<label className="checkbox-label">
				<input type="checkbox" defaultChecked disabled />
				<span className="selectbox"></span>Checkbox label (checked + disabled)
			</label>

			<hr />

			<label className="radio-label">
				<input type="radio" name="radio_D" value="1 " defaultChecked />
				<span className="selectbox"></span>Checkbox label (checked)
			</label>
			<label className="radio-label">
				<input type="radio" name="radio_D" value="2" />
				<span className="selectbox"></span>Checkbox
			</label>
			<label className="radio-label">
				<input type="radio" name="radio_D" value="3" />
				<span className="selectbox"></span>
			</label>
			<label className="radio-label">
				<input type="radio" name="radio_D" value="4" disabled />
				<span className="selectbox"></span>Checkbox label (disabled)
			</label>
			<label className="radio-label">
				<input type="radio" name="radio_D" value="1" defaultChecked disabled />
				<span className="selectbox"></span>Checkbox label (checked + disabled)
			</label>

			<hr />

			<h4>Styled nested list</h4>

			<hr />

			<label className="checkbox-label">
				<input type="checkbox" defaultChecked />
				<span className="selectbox"></span>Checkbox label (checked)
			</label>
			<br />
			<label className="checkbox-label">
				<input type="checkbox" />
				<span className="selectbox"></span>Checkbox
			</label>
			<br />
			<label className="checkbox-label">
				<input type="checkbox" />
				<span className="selectbox"></span>
			</label>
			<br />
			<label className="checkbox-label">
				<input type="checkbox" disabled />
				<span className="selectbox"></span>Checkbox label (disabled)
			</label>
			<br />
			<label className="checkbox-label">
				<input type="checkbox" defaultChecked disabled />
				<span className="selectbox"></span>Checkbox label (checked + disabled)
			</label>

			<hr />

			<label className="checkbox-label right-selectbox">
				<input type="checkbox" defaultChecked />
				Checkbox label (checked)<span className="selectbox"></span>
			</label>
			<br />
			<label className="checkbox-label right-selectbox">
				<input type="checkbox" />
				Checkbox label<span className="selectbox"></span>
			</label>
			<br />
			<label className="checkbox-label right-selectbox">
				<input type="checkbox" />
				<span className="selectbox"></span>
			</label>
			<br />
			<label className="checkbox-label right-selectbox">
				<input type="checkbox" disabled />
				Checkbox label (disabled)<span className="selectbox"></span>
			</label>
			<br />
			<label className="checkbox-label right-selectbox">
				<input type="checkbox" defaultChecked disabled />
				Checkbox label (checked + disabled)<span className="selectbox"></span>
			</label>

			<hr />

			<label className="radio-label">
				<input type="radio" name="radio_E" value="1 " defaultChecked />
				<span className="selectbox"></span>Checkbox label (checked)
			</label>
			<br />
			<label className="radio-label">
				<input type="radio" name="radio_E" value="2" />
				<span className="selectbox"></span>Checkbox
			</label>
			<br />
			<label className="radio-label">
				<input type="radio" name="radio_E" value="3" />
				<span className="selectbox"></span>
			</label>
			<br />
			<label className="radio-label">
				<input type="radio" name="radio_E" value="4" disabled />
				<span className="selectbox"></span>Checkbox label (disabled)
			</label>
			<br />
			<label className="radio-label">
				<input type="radio" name="radio_E" value="1" defaultChecked disabled />
				<span className="selectbox"></span>Checkbox label (checked + disabled)
			</label>

			<hr />

			<label className="radio-label right-selectbox">
				<input type="radio" name="radio_F" value="1 " defaultChecked />
				Checkbox label (checked)<span className="selectbox"></span>
			</label>
			<br />
			<label className="radio-label right-selectbox">
				<input type="radio" name="radio_F" value="2" />
				Checkbox label<span className="selectbox"></span>
			</label>
			<br />
			<label className="radio-label right-selectbox">
				<input type="radio" name="radio_F" value="3" />
				<span className="selectbox"></span>
			</label>
			<br />
			<label className="radio-label right-selectbox">
				<input type="radio" name="radio_F" value="4" disabled />
				Checkbox label (disabled)<span className="selectbox"></span>
			</label>
			<br />
			<label className="radio-label right-selectbox">
				<input type="radio" name="radio_F" value="1" defaultChecked disabled />
				Checkbox label (checked + disabled)<span className="selectbox"></span>
			</label>

			<hr />
		</div>
	);
}
