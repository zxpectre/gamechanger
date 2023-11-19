/* eslint-env mocha */
/* eslint-disable quotes */
/* global chai, gc,testDeps */

mocha.setup({
  ui: 'bdd'
})

describe('unit tests', () => {
  const { expect /*, assert*/ } = chai

  describe('Dependencies Test', () => {
    it('should load dependencies', async () => {
      const res = await testDeps()
      expect(res).to.equal('OK')
    })
  })

  describe('Encoders Unit tests', () => {
    it('should build the correct APIv1 url for a dummy script', async () => {
      const url = await gc.encode.url({
        apiVersion: '1',
        network: 'mainnet',
        encoding: 'json-url-lzw',
        input: `{
        "type": "tx",
        "title": "Demo",
        "description": "created with gamechanger-dapp-cli",
        "metadata": {
          "123": {
            "message": "Hello World!"
          }
        }
      }`
      })

      expect(url).to.equal(
        'https://wallet.gamechanger.finance/api/1/tx/woTCpHR5cGXConR4wqV0aXRsZcKkRGVtb8KrZGVzY3JpcMSKb27DmSHEmGVhdGVkIHfEi2ggZ2FtZWNoYW5nZXItZGFwcC1jbGnCqMSudGHEuMWCwoHCozEyM8KBwqfErnNzYcS0wqxIZWxsbyBXb3JsZCE'
      )
    })
    it('should build the correct APIv2 url for a dummy script', async () => {
      const url = await gc.encode.url({
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        input: `{
        "type": "tx",
        "title": "Demo",
        "description": "created with gamechanger-dapp-cli",
        "metadata": {
          "123": {
            "message": "Hello World!"
          }
        }
      }`
      })
      expect(url).to.equal(
        'https://beta-wallet.gamechanger.finance/api/2/1-H4sIAAAAAAAAAxWMMQrDMBAEvyJfHRdJOtcp_IPUh7TIBydLSAdJMPp7pGqYgd2L7FdAG9mXbmRiOuWFlIcGNF-lmORzRF_BhuA-YoeLnOAPPiPqGriU1auMRYJxYGPaLro_nhMJrXGcrztUs3vnqmGh3vsfzM0kLnwAAAA'
      )
    })

    it('should build the correct APIv2 QR for a dummy script', async () => {
      const qr = await gc.encode.qr({
        apiVersion: '2',
        network: 'mainnet',
        encoding: 'gzip',
        input: `{
        "type": "tx",
        "title": "Demo",
        "description": "created with gamechanger-dapp-cli",
        "metadata": {
          "123": {
            "message": "Hello World!"
          }
        }
      }`
      })
      expect(qr).not.to.be.empty
    })
  })
})

mocha.run()
