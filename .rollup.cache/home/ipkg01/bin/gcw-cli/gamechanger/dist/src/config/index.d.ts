import { APIEncoding, APIVersion, NetworkType } from '../types'
export declare const cliName = 'gamechanger-dapp-cli'
export declare const networks: NetworkType[]
export declare const apiVersions: APIVersion[]
export declare const apiEncodings: {
  [apiVer: string]: APIEncoding[]
}
export declare const GCDappConnUrls: {
  '1': {
    mainnet: string
    preprod: string
  }
  '2': {
    mainnet: string
    preprod: string
  }
}
export declare const QRRenderTypes: string[]
export declare const demoGCS: {
  type: string
  title: string
  description: string
  metadata: {
    '123': {
      message: string
    }
  }
}
export declare const demoPacked =
  'woTCpHR5cGXConR4wqV0aXRsZcKkRGVtb8KrZGVzY3JpcMSKb27DmSHEmGVhdGVkIHfEi2ggZ2FtZWNoYW5nZXItZGFwcC1jbGnCqMSudGHEuMWCwoHCozEyM8KBwqfErnNzYcS0wqxIZWxsbyBXb3JsZCE'
export declare const escapeShellArg: (arg: string) => string
export declare const usageMessage: string
//# sourceMappingURL=index.d.ts.map
