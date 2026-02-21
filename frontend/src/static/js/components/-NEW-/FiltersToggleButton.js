import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { MaterialIcon } from './MaterialIcon';

export function FiltersToggleButton({ active = false, onClick }){

	const [ isActive, setIsActive ] = useState( active );

	function handleClick(){
		setIsActive( ! isActive );
		if( 'function' === typeof onClick ){
			onClick();
		}
	}

	return (<div className="mi-filters-toggle">
				<button className={ isActive ? 'active' : '' } aria-label="Filter" onClick={ handleClick }>
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

