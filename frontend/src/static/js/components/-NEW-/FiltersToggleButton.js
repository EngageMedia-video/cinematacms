import React from 'react';
import PropTypes from 'prop-types';

import { MaterialIcon } from './MaterialIcon';

export function FiltersToggleButton({ active = false, onClick }){

	function handleClick(){
		if( 'function' === typeof onClick ){
			onClick();
		}
	}

	return (<div className="mi-filters-toggle">
				<button className={ active ? 'active' : '' } aria-label="Filter" onClick={ handleClick }>
					<MaterialIcon type="filter_list" />
					<span className="filter-button-label">
						<span className="filter-button-label-text">FILTERS</span>
					</span>
				</button>
			</div>);
}

FiltersToggleButton.propTypes = {
    onClick: PropTypes.func,
	active: PropTypes.bool,
};

