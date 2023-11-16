import { DefaultQRSubTitle, DefaultQRTitle } from '../types';
import { resolveGlobal } from '../utils';

const logoURL = resolveGlobal('../assets/images/dapp-logo-bg.png');
const backgroundURL = resolveGlobal('../assets/images/background.png');

export const size = 1024;

const defaultTemplate = {
	text: '',
	width: size,
	height: size,
	colorDark: '#000000',
	colorLight: 'rgba(0,0,0,0)',
	drawer: 'canvas',
	logo: logoURL,
	logoWidth: 433,
	logoHeight: 118,
	dotScale: 1,
	logoBackgroundTransparent: true,
	backgroundImage: backgroundURL,
	autoColor: false,
	quietZone: 60,
};

type StyleType = {
	[name: string]: { [name: string]: string | undefined | number | boolean };
};

const styles: StyleType = {
	//default: defaultTemplate,
	boxed: {
		...defaultTemplate,
		quietZone: 60,
		quietZoneColor: 'rgba(0,0,0,0)',
		title: DefaultQRTitle,
		subTitle: DefaultQRSubTitle,
		titleTop: -25,
		subTitleTop: -8,
		titleHeight: 0,
		titleBackgroundColor: 'rgba(0,0,0,0)',
		titleColor: '#111111',
		subTitleColor: '#222222',
		titleFont: 'normal normal bold 12px Abstract',
		subTitleFont: 'normal normal bold 9px Abstract',
	},
	printable: {
		...defaultTemplate,
		logo: undefined,
		logoWidth: undefined,
		logoHeight: undefined,
		colorDark: '#000000',
		colorLight: '#ffffff',
		backgroundImage: undefined,
		title: DefaultQRTitle,
		subTitle: DefaultQRSubTitle,
		quietZone: 60,
		quietZoneColor: 'rgba(0,0,0,0)',
		titleTop: -25,
		subTitleTop: -8,
		titleHeight: 0,
		titleBackgroundColor: '#ffffff',
		titleColor: '#000000',
		subTitleColor: '#000000',
		titleFont: 'normal normal bold 12px Abstract',
		subTitleFont: 'normal normal bold 9px Abstract',
	},
};

export default styles;
