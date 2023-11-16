import path from 'path';

import { apiEncodings, apiVersions, networks } from '../config';
import { APIEncoding, APIVersion, DefaultAPIEncodings, DefaultAPIVersion, DefaultNetwork, NetworkType } from '../types';

export const resolveGlobal = (file) => {
	return path.resolve(__dirname, file);
};



export const validateBuildMsgArgs=(	
	args:{
		//actionPath: string[], //TODO: [action,subAction,subSubAction...]
		apiVersion: APIVersion,
		network		: NetworkType;
		encoding	:	APIEncoding,
		input			: string;
	}) => {
		const network=args?.network?args?.network:DefaultNetwork;
		if (!networks.includes(network)) {
			throw new Error(`Unknown Cardano network specification '${network||""}'`);
		}

		const apiVersion:APIVersion 			= args?.apiVersion 	? <APIVersion> args?.apiVersion : DefaultAPIVersion;
		if(!apiVersions.includes(apiVersion))
			throw new Error(`Unknown API version '${apiVersion||""}'`);

		const defaultEncoding:APIEncoding	= DefaultAPIEncodings[apiVersion];
		const encoding:APIEncoding  			= args?.encoding		? <APIEncoding>args?.encoding :defaultEncoding;
		if(!apiEncodings[apiVersion].includes(encoding))
			throw new Error(`Unknown encoding '${encoding||""}' for API version '${apiVersion||""}'`);
		
		const input=args?.input;
		if (!input) 
			throw new Error('Empty GCScript provided');
		if (typeof input!=="string") 
			throw new Error('Wrong input type. GCScript must be presented as JSON string');

		return {
			apiVersion,
			network,
			encoding,
			input,
		}
	}



