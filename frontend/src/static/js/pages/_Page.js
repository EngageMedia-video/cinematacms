import React from "react";
import ReactDOM from "react-dom";

import * as PageActions from "./_PageActions";

import { VisitorPopup } from "../components/-NEW-/VisitorPopup.jsx";

import PageMain from "../components/-NEW-/PageMain";
import { Notifications } from "../components/-NEW-/Notifications";
import { LayoutProvider } from "../contexts/LayoutContext";

export class Page extends React.PureComponent {
	constructor(props, pageId) {
		super(props);

		if (void 0 !== pageId) {
			PageActions.initPage(pageId);
		}
	}

	render() {
		return (
			<LayoutProvider>
				<PageMain>{this.pageContent()}</PageMain>
				<Notifications />
			</LayoutProvider>
		);
	}
}
