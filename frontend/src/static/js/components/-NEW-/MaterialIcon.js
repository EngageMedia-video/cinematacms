import React from 'react';

export const MaterialIcon = ({ type }) => (type ? <i className="material-icons" data-icon={type}></i> : null);
