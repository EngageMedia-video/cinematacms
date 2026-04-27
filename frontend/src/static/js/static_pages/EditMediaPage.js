import React from 'react';
import ReactDOM from 'react-dom';

import { Page } from './_StaticPage';
import * as PageActions from './_StaticPageActions';

import { addClassname, removeClassname } from '../functions/dom.js';

// TODO: Transfer page into static template.

export class EditMediaPage extends React.PureComponent {
	constructor(props) {
		super(props);

		PageActions.initPage('edit-media');

		this.isLicensePopupOpen = false;
		this.isLicenseDisabled = false;

		this.selectedFields = {
			commercial: null,
			derivatives: null,
		};

		this.licenses = {
			9: {
				title: 'Attribution 4.0 International',
				allow_commercial: 'Yes',
				allow_modifications: 'Yes',
			},
			8: {
				title: 'Attribution-ShareAlike 4.0 International',
				allow_commercial: 'Yes',
				allow_modifications: 'Partially',
			},
			7: {
				title: 'Attribution-NoDerivatives 4.0 International',
				allow_commercial: 'Yes',
				allow_modifications: 'No',
			},
			6: {
				title: 'Attribution-NonCommercial 4.0 International',
				allow_commercial: 'No',
				allow_modifications: 'Yes',
			},
			5: {
				title: 'Attribution-NonCommercial-ShareAlike 4.0 International',
				allow_commercial: 'No',
				allow_modifications: 'Partially',
			},
			1: {
				title: 'Attribution-NonCommercial-NoDerivatives 4.0 International',
				allow_commercial: 'No',
				allow_modifications: 'No',
			},
		};
	}

	componentDidMount() {
		// var licenses = JSON.parse( JSON.parse(document.getElementById('licenses-data').textContent) );
		var licenses = this.licenses;

		var elem = {
			selected_license_title: document.querySelector('.selected-license-title'),
			license_value_field: document.querySelector('.license-hidden-field'),
			popup: document.querySelector('.license_controls_options'),
			btn: {
				openPopup: document.querySelector('.open-licenses-options'),
				closePopup: document.querySelector('.btn-close-license'),
				chooseLicense: document.querySelector('.btn-choose-license'),
			},
			license_input: {
				commercial: document.querySelectorAll('input[name="field_commercial"]'),
				derivatives: document.querySelectorAll('input[name="field_derivatives"]'),
			},
			license_disable_check: document.querySelector('input[name="no_license"]'),
		};

		var init_license_fields = function (defaultValue) {
			if (null !== elem.license_disable_check) {
				if ('none' === elem.license_value_field.value || 'None' === elem.license_value_field.value) {
					this.isLicenseDisabled = true;
					elem.license_disable_check.checked = true;
				} else {
					this.isLicenseDisabled = elem.license_disable_check.checked;
				}
			}

			let k;
			let found = false;

			for (k in licenses) {
				if (licenses.hasOwnProperty(k)) {
					if (defaultValue === k.toString()) {
						found = true;

						if (!this.isLicenseDisabled) {
							elem.selected_license_title.innerHTML = licenses[k].title;
						}

						this.selectedFields.commercial = licenses[k].allow_commercial;
						this.selectedFields.derivatives = licenses[k].allow_modifications;

						update_license_fields();
					}
				}
			}

			if (!this.isLicenseDisabled && !found) {
				this.isLicenseDisabled = true;
				elem.license_disable_check.checked = true;
			}

			if (this.isLicenseDisabled) {
				elem.selected_license_title.innerHTML = '-';
			}
		}.bind(this);

		var update_license_fields = function () {
			if (null === this.selectedFields.commercial || null === this.selectedFields.derivatives) {
				elem.selected_license_title.innerHTML = '';
				return;
			}

			var commercialValue = this.selectedFields.commercial;
			var derivativesValue = this.selectedFields.derivatives;

			var commercialInput = elem.license_input.commercial;
			var derivativesInput = elem.license_input.derivatives;

			var i;

			if (null !== commercialInput && commercialInput.length) {
				i = 0;
				while (i < commercialInput.length) {
					if (commercialInput[i].value === commercialValue) {
						commercialInput[i].checked = true;
					} else {
						commercialInput[i].checked = false;
					}
					i += 1;
				}
			}

			if (null !== derivativesInput && derivativesInput.length) {
				i = 0;
				while (i < derivativesInput.length) {
					if (derivativesInput[i].value === derivativesValue) {
						derivativesInput[i].checked = true;
					} else {
						derivativesInput[i].checked = false;
					}
					i += 1;
				}
			}
		}.bind(this);

		function on_open_popup(ev) {
			removeClassname(elem.popup, 'is-hidden');
			this.isLicensePopupOpen = true;
		}

		function on_close_popup(ev) {
			addClassname(elem.popup, 'is-hidden');
			this.isLicensePopupOpen = false;
		}

		function on_license_choose(ev) {
			addClassname(elem.popup, 'is-hidden');

			this.isLicensePopupOpen = false;
			this.selectedFields.commercial = this.selectedFields.commercial;
			this.selectedFields.derivatives = this.selectedFields.derivatives;

			if (null !== elem.selected_license_title) {
				let k;
				for (k in licenses) {
					if (licenses.hasOwnProperty(k)) {
						if (
							this.selectedFields.commercial === licenses[k].allow_commercial &&
							this.selectedFields.derivatives === licenses[k].allow_modifications
						) {
							elem.selected_license_title.innerHTML = licenses[k].title;
							elem.license_value_field.setAttribute('value', k);

							this.isLicenseDisabled = false;
							elem.license_disable_check.checked = false;
						}
					}
				}
			}
		}

		function on_commercial_option_change(ev) {
			this.selectedFields.commercial = ev.target.value;
		}

		function on_derivatives_option_change(ev) {
			this.selectedFields.derivatives = ev.target.value;
		}

		function on_license_disable_change(ev) {
			this.isLicenseDisabled = elem.license_disable_check.checked;

			if (this.isLicenseDisabled) {
				elem.selected_license_title.innerHTML = '-';
			} else if (null === this.selectedFields.commercial || null === this.selectedFields.derivatives) {
				elem.selected_license_title.innerHTML = '';
				return;
			} else {
				let k;
				for (k in licenses) {
					if (licenses.hasOwnProperty(k)) {
						if (
							this.selectedFields.commercial === licenses[k].allow_commercial &&
							this.selectedFields.derivatives === licenses[k].allow_modifications
						) {
							elem.selected_license_title.innerHTML = licenses[k].title;
						}
					}
				}
			}
		}

		var button_events = function () {
			if (null !== elem.btn.openPopup) {
				elem.btn.openPopup.addEventListener('click', on_open_popup.bind(this));
			}

			if (null !== elem.btn.closePopup) {
				elem.btn.closePopup.addEventListener('click', on_close_popup.bind(this));
			}

			if (null !== elem.btn.chooseLicense) {
				elem.btn.chooseLicense.addEventListener('click', on_license_choose.bind(this));
			}
		}.bind(this);

		var input_events = function () {
			var commercialInput = elem.license_input.commercial;
			var derivativesInput = elem.license_input.derivatives;

			var i;

			if (null !== commercialInput && commercialInput.length) {
				i = 0;
				while (i < commercialInput.length) {
					commercialInput[i].addEventListener('change', on_commercial_option_change.bind(this));
					i += 1;
				}
			}

			if (null !== derivativesInput && derivativesInput.length) {
				i = 0;
				while (i < derivativesInput.length) {
					derivativesInput[i].addEventListener('change', on_derivatives_option_change.bind(this));
					i += 1;
				}
			}

			if (null !== elem.license_disable_check) {
				elem.license_disable_check.addEventListener('change', on_license_disable_change.bind(this));
			}
		}.bind(this);

		if (null !== elem.popup && null !== elem.license_value_field) {
			button_events();
			input_events();
			init_license_fields(elem.license_value_field.value.toString());
		}
	}

	render() {
		return (
			<Page>
				<div className="user-action-form-wrap">
					<div className="user-action-form-inner">
						<h1>Edit Media</h1>

						<form encType="multipart/form-data" action="" method="post" className="post-form">
							<p class="requiredField">
								<i>Required fields with a red star</i> <span class="asteriskField">*</span>
							</p>

							<span className="editorial-pocicy-notice">
								Please check our{' '}
								<a href="./editorial-policy" title="Editorial Policy">
									Editorial Policy
								</a>{' '}
								before uploading media.
							</span>

							<div id="div_id_custom_license" className="control-group">
								<input
									type="hidden"
									className="license-hidden-field"
									id="id_{{field.name}}"
									name="{{field.name}}"
									value="{{field.value}}"
								/>

								<label htmlFor="id_custom_license" className="control-label ">
									License
								</label>

								<div className="license_controls">
									<div className="license_controls_header">
										<span className="selected-license-title"></span>
										<button type="button" title="Choose license" className="open-licenses-options">
											Choose
										</button>
									</div>
									<div className="license_controls_options is-hidden">
										<div>
											<div>
												<div className="license-form">
													<div className="license-form-content">
														<p>
															Creative Commons licenses help you share your work while
															keeping your copyright. Other people can copy and distribute
															your work provided they{' '}
															<a
																href="https://creativecommons.org/characteristic/by?lang=en"
																target="_blank"
															>
																give you credit
															</a>{' '}
															-- and only on the conditions you specify here. This page
															helps you choose those conditions.
														</p>
														<p>
															If you want to share a work you created with no conditions,
															choose{' '}
															<a
																href="https://creativecommons.org/choose/zero/partner?partner=Plone&exit_url=https%3A%2F%2Fplumi.engagemedia.org%2Finsert_license%3Flicense_url%3D%5Blicense_url%5D%26license_name%3D%5Blicense_name%5D%26license_button%3D%5Blicense_button%5D%26license_radio_id%3Dlicense_2%26license_id%3DCreative+Commons+License"
																target="_blank"
															>
																CC0
															</a>
															. If you're sharing a work that isn't covered by copyright
															or on which the copyright has expired, choose the{' '}
															<a
																href="https://creativecommons.org/choose/mark/partner?partner=Plone&exit_url=https%3A%2F%2Fplumi.engagemedia.org%2Finsert_license%3Flicense_url%3D%5Blicense_url%5D%26license_name%3D%5Blicense_name%5D%26license_button%3D%5Blicense_button%5D%26license_radio_id%3Dlicense_2%26license_id%3DCreative+Commons+License"
																target="_blank"
															>
																Public Domain Mark
															</a>
															.
														</p>

														<div className="license-radio-options">
															<p>
																<span>
																	<strong>Allow commercial uses of your work?</strong>{' '}
																	(
																	<a
																		href="/characteristic/nc?lang=en_US"
																		target="_blank"
																	>
																		more info
																	</a>
																	)
																</span>
																<label>
																	<input
																		type="radio"
																		name="field_commercial"
																		value="Yes"
																	/>
																	Yes
																</label>
																<label>
																	<input
																		type="radio"
																		name="field_commercial"
																		value="No"
																	/>
																	No
																</label>
															</p>

															<p>
																<span>
																	<strong>Allow modifications of your work?</strong> (
																	<a
																		href="/characteristic/nd?lang=en_US"
																		target="_blank"
																	>
																		more info
																	</a>
																	)
																</span>
																<label>
																	<input
																		type="radio"
																		name="field_derivatives"
																		value="Yes"
																	/>
																	Yes
																</label>
																<label>
																	<input
																		type="radio"
																		name="field_derivatives"
																		value="Partially"
																	/>
																	Yes, as long as others share alike (
																	<a
																		href="/characteristic/sa?lang=en_US"
																		target="_blank"
																	>
																		more info
																	</a>
																	)
																</label>
																<label>
																	<input
																		type="radio"
																		name="field_derivatives"
																		value="No"
																	/>
																	No
																</label>
															</p>
														</div>

														<p>
															<em>Note:</em> To license a work, you must be its copyright
															holder or have express authorization from its copyright
															holder to do so.
														</p>
														<p>
															Creative Commons does not provide legal advice or services.
															We provide form legal documents; the rest is up to you.
														</p>
													</div>

													<div className="license-form-buttons">
														<button type="button" className="btn-close-license">
															CANCEL
														</button>
														<button type="button" className="btn-choose-license">
															UPDATE LICENSE
														</button>
													</div>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>

							<div id="div_id_no_license" className="control-group">
								<div className="controls">
									<label htmlFor="id_no_license" className="checkbox">
										<input
											type="checkbox"
											name="no_license"
											className="checkboxinput"
											id="id_no_license"
										/>
										Or choose no license{' '}
									</label>
								</div>
							</div>

							<div id="div_id_title" className="control-group">
								<label htmlFor="id_title" className="control-label ">
									Title
								</label>
								<div className="controls">
									<input
										type="text"
										name="title"
										defaultValue="koryfh-ziria.mp4"
										maxLength="100"
										className="textinput textInput"
										id="id_title"
									/>
								</div>
							</div>

							<div id="div_id_category" className="control-group">
								<label htmlFor="id_category" className="control-label ">
									Category
								</label>
								<div className="controls">
									<select name="category" className="selectmultiple" id="id_category" multiple={true}>
										<option value="1">Art</option>
										<option value="2">Documentary</option>
										<option value="3">Experimental</option>
										<option value="4">Film</option>
										<option value="5">Music</option>
										<option value="6">TV</option>
									</select>
								</div>
							</div>

							<div id="div_id_new_tags" className="control-group">
								<label htmlFor="id_new_tags" className="control-label ">
									Tags
								</label>
								<div className="controls">
									<input
										type="text"
										name="new_tags"
										className="textinput textInput"
										id="id_new_tags"
									/>
									<p id="hint_id_new_tags" className="help-block">
										a comma separated list of new tags.
									</p>
								</div>
							</div>

							<div id="div_id_description" className="control-group">
								<label htmlFor="id_description" className="control-label ">
									Description
								</label>
								<div className="controls">
									<textarea
										name="description"
										cols="40"
										rows="10"
										className="textarea"
										id="id_description"
										defaultValue="rgf dsadsaqewrtetrh fff"
									></textarea>
								</div>
							</div>

							<div id="div_id_state" className="control-group">
								<label htmlFor="id_state" className="control-label requiredField">
									State<span className="asteriskField">*</span>{' '}
								</label>
								<div className="controls">
									<select name="state" className="select" id="id_state" defaultValue="public">
										<option value="private">Private</option>
										<option value="public">Public</option>
										<option value="unlisted">Unlisted</option>
									</select>
								</div>
							</div>

							<div id="div_id_enable_comments" className="control-group">
								<div className="controls">
									<label htmlFor="id_enable_comments" className="checkbox ">
										<input
											type="checkbox"
											name="enable_comments"
											className="checkboxinput"
											id="id_enable_comments"
										/>
										Enable comments
									</label>
									<p id="hint_id_enable_comments" className="help-block">
										Whether comments will be allowed for this media
									</p>
								</div>
							</div>

							<div id="div_id_featured" className="control-group">
								<div className="controls">
									<label htmlFor="id_featured" className="checkbox ">
										<input
											type="checkbox"
											name="featured"
											className="checkboxinput"
											id="id_featured"
										/>
										Featured
									</label>
									<p id="hint_id_featured" className="help-block">
										Globally featured
									</p>
								</div>
							</div>

							<div id="div_id_thumbnail_time" className="control-group">
								<label htmlFor="id_thumbnail_time" className="control-label ">
									Thumbnail time
								</label>
								<div className="controls">
									<input
										type="number"
										name="thumbnail_time"
										defaultValue="13.0"
										step="any"
										className="numberinput"
										id="id_thumbnail_time"
									/>
									<p id="hint_id_thumbnail_time" className="help-block">
										Time on video file that a thumbnail will be taken
									</p>
								</div>
							</div>

							<div id="div_id_reported_times" className="control-group">
								<label htmlFor="id_reported_times" className="control-label requiredField">
									Reported times<span className="asteriskField">*</span>{' '}
								</label>
								<div className="controls">
									<input
										type="number"
										name="reported_times"
										defaultValue="0"
										className="numberinput"
										required=""
										id="id_reported_times"
									/>
								</div>
							</div>

							<div id="div_id_is_reviewed" className="control-group">
								<div className="controls">
									<label htmlFor="id_is_reviewed" className="checkbox ">
										<input
											type="checkbox"
											name="is_reviewed"
											className="checkboxinput"
											id="id_is_reviewed"
										/>
										Is reviewed
									</label>
									<p id="hint_id_is_reviewed" className="help-block">
										Media is reviewed by admin. If not it will not appear on public listings
									</p>
								</div>
							</div>

							<button className="primaryAction" type="submit">
								Update Media
							</button>
						</form>
					</div>
				</div>
			</Page>
		);
	}
}
