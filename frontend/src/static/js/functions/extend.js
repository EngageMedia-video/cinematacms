function extend(out) {
    let i, key;
    out = out || {};
    for (i = 1; i < arguments.length; i++) {
        if (arguments[i]) {
	        for (key in arguments[i]) {
	            if (arguments[i].hasOwnProperty(key)) {
	            	out[key] = arguments[i][key] === Object( arguments[i][key] ) ? extend(out[key], arguments[i][key]) : arguments[i][key];
	            }
	        }
	    }
    }
    return out;
}

export default extend;
