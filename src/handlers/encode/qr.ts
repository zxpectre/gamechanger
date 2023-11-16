import { GCDappConnUrls } from '../../config';
import { APIEncoding, APIVersion, DefaultQRTemplate, NetworkType, QRTemplateType } from '../../types';
import { validateBuildMsgArgs } from '../../utils';

import urlEncoder from '../../encodings/url';
import path from 'path';
import createQRCode from '../../qr';
import styles from '../../config/styles';

export default async (	
	args:{
		apiVersion: APIVersion,
		network		: NetworkType,
		encoding	:	APIEncoding,
		input			: string,
		debug?		: boolean,

		outputFile?: string,
		template?	 : QRTemplateType | string,
		styles?		 : string, //JSON
	}) => {
	try{
		const {apiVersion,network,encoding,input}=validateBuildMsgArgs(args);
		
		const obj = JSON.parse(input);
		const urlPattern=GCDappConnUrls[apiVersion][network];
		if(!urlPattern)
			throw new Error(`Missing URL pattern for network '${network||""}'`);
		const url = await urlEncoder.encoder(obj,{
			urlPattern,
			encoding
		});

		const template =
			args?.template && styles[args?.template]
				? args?.template
				: DefaultQRTemplate;

		const qrCode = createQRCode(url, template);

		if (args?.styles) {
			let extendedStyle = {};
			try {
				extendedStyle = JSON.parse(args?.styles);
			} finally {
				qrCode.changeStyles(extendedStyle);
			}
		}

		if (args?.outputFile) {
			await qrCode.saveImage({
				path: path.resolve(process.cwd(), `./${args?.outputFile}`),
			});
		} else {
			const stream = await qrCode.toStream();
			stream.pipe(process.stdout);
		}
		
		return url;
	}catch(err){				
		if(err instanceof Error)
			throw new Error('QR URL generation failed. ' + err?.message);
		else 
			throw new Error('QR URL generation failed. ' + "Unknown error");		
	}
};
