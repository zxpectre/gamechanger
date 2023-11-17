import 'node-self';
//import QRCode from 'easyqrcodejs-nodejs';
import convert from 'data-uri-to-buffer';
import Style, { size } from '../config/styles';
import Canvas from 'canvas';

import { ObjectType } from '../types';
import { resolveGlobal } from '../utils';

const { registerFont } = Canvas;
const fontURL = resolveGlobal('../assets/fonts/ABSTRACT.ttf');

export const getBackground = async (width: number = size) => {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (ctx) {
		const container = document.getElementById('gamearea') || document.body;

		container.appendChild(canvas);
		canvas.width = width;
		canvas.height = width;

		const sp = {
				x: 0,
				y: 0,
			},
			ep = {
				x: canvas.width,
				y: 0,
			};

		const gradient = ctx.createLinearGradient(sp.x, sp.y, ep.x, ep.y);
		gradient.addColorStop(0, '#1f00ff');
		gradient.addColorStop(1, '#9800ff');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		const buffer = await convert(canvas.toDataURL('image/png'));
		return Promise.resolve(buffer);
	}
	return Promise.reject(new Error('Canvas not available'));
};



export default async function createQRCode(text: string, template = 'default') {

	const QRCode = require('easyqrcodejs-nodejs')
	//await import('easyqrcodejs-nodejs').then(d=>d.default);

	class QRCodeWrapper extends QRCode {
		private _htOption!: ObjectType;
	
		constructor(options: ObjectType) {
			super(options);
		}
	
		changeStyles(styles: ObjectType) {
			this._htOption = {
				...(this._htOption || {}),
				...styles,
			};
		}
	}


	registerFont(fontURL, { family: 'Abstract' });
	const style = Style[template];
	const qrCode = new QRCodeWrapper({
		...style,
		text: text,
	});
	return qrCode;
}


/*

Dependencies that are not compatible with browser:

└─┬ easyqrcodejs-nodejs@4.4.3
  ├─┬ canvas@2.11.2
  │ └─┬ @mapbox/node-pre-gyp@1.0.11
  │   └── https-proxy-agent@5.0.1 deduped
  └─┬ jsdom@18.1.1
    ├── https-proxy-agent@5.0.1
    └─┬ whatwg-encoding@2.0.0
      └─┬ iconv-lite@0.6.3
        └── safer-buffer@2.1.2


*/
