import { expect } from 'chai';
import handlers from '../index';

describe('GameChanger DAPP CLI', () => {
	it('should build the correct url for the demo.gcs script', async () => {
		const url = await handlers.encode.url({
			apiVersion:'1',
			network: 'mainnet',
			encoding:'json-url-lzw',
			input: `{
			"type": "tx",
			"title": "Demo",
			"description": "created with gamechanger-dapp-cli",
			"metadata": {
				"123": {
					"message": "Hello World!"
				}
			}
		}`,
		});

		expect(url).to.equal(
			'https://wallet.gamechanger.finance/api/1/tx/woTCpHR5cGXConR4wqV0aXRsZcKkRGVtb8KrZGVzY3JpcMSKb27DmSHEmGVhdGVkIHfEi2ggZ2FtZWNoYW5nZXItZGFwcC1jbGnCqMSudGHEuMWCwoHCozEyM8KBwqfErnNzYcS0wqxIZWxsbyBXb3JsZCE'
		);
	});
});
