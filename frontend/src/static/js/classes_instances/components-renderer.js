import React from 'react';
import { createRoot } from 'react-dom/client';
import { logErrorAndReturnError } from "../functions/errors";

function componentRenderer(){
	const roots = new Map();
	return {
		display: function(wrapEl, AppComp, props, id){
			if(! wrapEl ){
				return logErrorAndReturnError(["Invalid dom element to render the component", wrapEl]);
			}
			if(! AppComp ){
				return logErrorAndReturnError(["Invalid component's reference to render", AppComp]);
			}
			id = id || ( AppComp ? AppComp.name + "_" + new Date().valueOf() : null ) ;
			if( id ){
				const existing = roots.get(id);
				if( existing && existing.container !== wrapEl ){
					existing.root.unmount();
					roots.delete(id);
				}
				if( !roots.has(id) ){
					roots.set(id, { root: createRoot(wrapEl), container: wrapEl });
				}
				roots.get(id).root.render(<AppComp {...props} />);
			}
			return id;
		},
		destroy: function(id){
			if( id && roots.has(id) ){
				roots.get(id).root.unmount();
				roots.delete(id);
			}
		}
	};
};

export default componentRenderer();

if (import.meta.hot) {
	import.meta.hot.decline();
}
