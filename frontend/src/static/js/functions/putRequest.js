import axios from 'axios';
import { error as logError } from "./log";

async function putRequest(url, putData, configData, sync, callback, errorCallback) {

    putData = putData || {};

    function responseHandler(result) {
        if( callback instanceof Function ) {
            callback( result );
        }
    }

    function errorHandler(error) {
        if( errorCallback instanceof Function ) {
            errorCallback( error );
        }
    }

    if( sync ){
        await axios.put(url, putData, configData || null).then(responseHandler).catch(errorHandler || null);
    }
    else{
        axios.put(url, putData, configData || null).then(responseHandler).catch(errorHandler || null);
    }
};

export default putRequest;
