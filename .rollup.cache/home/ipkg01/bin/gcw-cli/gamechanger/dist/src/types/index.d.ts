export type NetworkType = 'preprod' | 'mainnet'
export type APIEncoding =
  | 'json-url-lzw'
  | 'json-url-lzma'
  | 'gzip'
  | 'base64url'
export type APIVersion = '1' | '2'
export declare const DefaultNetwork: NetworkType
export declare const DefaultAPIVersion: APIVersion
export declare const DefaultAPIEncodings: {
  [apiVer: string]: APIEncoding
}
export type EncodingHandler = {
  name: string
  encoder: (obj: any, options?: any) => Promise<string>
  decoder: (msg: string, options?: any) => Promise<any>
}
export type HandlerInputType =
  | {
      apiVersion: '1'
      network: NetworkType
      encoding: 'json-url-lzw'
      inputData: string
    }
  | {
      apiVersion: '2'
      network: NetworkType
      encoding: 'json-url-lzma' | 'gzip' | 'base64url'
      inputData: string
    }
export type CLIHandlerContext = {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  outputFile?: string
  template?: string
  styles?: string
  debug?: boolean
}
export type SourceType = {
  [name: string]: () => Promise<any>
}
export type ActionHandlerLoaderType = {
  [action: string]: {
    [name: string]: () => Promise<(input: CLIHandlerContext) => any>
  }
}
export type ActionHandlerType = {
  [action: string]: {
    [name: string]: (input: CLIHandlerContext) => any
  }
}
export type ExecuteType = {
  network: NetworkType
  action: (input: HandlerInputType) => Promise<any>
  source: () => Promise<string>
}
export type ObjectType = {
  [name: string]: any
}
export type QRTemplateType = 'boxed' | 'printable'
export declare const DefaultQRTemplate: QRTemplateType
export declare const DefaultQRTitle = 'Dapp Connection'
export declare const DefaultQRSubTitle =
  'scan to execute | escanear para ejecutar'
//# sourceMappingURL=index.d.ts.map
