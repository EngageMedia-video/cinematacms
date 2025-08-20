let TAXONOMIES = null;

export function init( settings ){

	TAXONOMIES = {
	    tags: {
	    	enabled: true,
	    	title: 'Tags',
	    },
	    categories: {
	    	enabled: true,
	    	title: 'Categories',
	    },
	    topics: {
	    	enabled: true,
	    	title: 'Topics',
	    },
	    languages: {
	    	enabled: true,
	    	title: 'Languages',
	    },
	    countries: {
	    	enabled: true,
	    	title: 'Countries',
	    },
    };

    if( void 0 !== settings ){

		for(let k in TAXONOMIES){

			if( void 0 !== settings[k] ){

				TAXONOMIES[k].enabled = true;

				if( void 0 !== settings[k].enabled && false === settings[k].enabled ){
					TAXONOMIES[k].enabled = false;
				}
				
				if( 'string' === typeof settings[k].title ){
					TAXONOMIES[k].title = settings[k].title.trim();
				}
			}		
		}
	}
}

export function settings(){
	return TAXONOMIES;
}
