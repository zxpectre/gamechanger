declare const _default: {
  url: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
  }) => Promise<string>
  qr: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
    qrResultType?: 'png' | 'svg' | undefined
    outputFile?: string | undefined
    template?: string | undefined
    styles?: string | undefined
  }) => Promise<string>
  button: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
  }) => Promise<string>
  html: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
  }) => Promise<string>
  express: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
  }) => Promise<string>
  react: (args: {
    apiVersion: import('../../types').APIVersion
    network: import('../../types').NetworkType
    encoding: import('../../types').APIEncoding
    input: string
    debug?: boolean | undefined
  }) => Promise<string>
}
export default _default
//# sourceMappingURL=index.d.ts.map
