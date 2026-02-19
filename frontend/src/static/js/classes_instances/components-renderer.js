import React from 'react';
import { createRoot } from 'react-dom/client';
import { logErrorAndReturnError, logWarningAndReturnError } from "../functions/errors";

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
			if( id && !roots.has(id) ){
				roots.set(id, createRoot(wrapEl));
			}
			if( roots.has(id) ){
				roots.get(id).render(<AppComp {...props} />);
			}
			return null;
		}
	};
};

export default componentRenderer();
