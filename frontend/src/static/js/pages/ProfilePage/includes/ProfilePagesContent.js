import React from 'react';
import ReactDOM from 'react-dom';

export default class ProfilePagesContent extends React.PureComponent {
	render() {
		return this.props.children ? (
			<div className={'profile-page-content' + (this.props.enabledContactForm ? ' with-cform' : '')}>
				{this.props.children}
			</div>
		) : null;
	}
}
