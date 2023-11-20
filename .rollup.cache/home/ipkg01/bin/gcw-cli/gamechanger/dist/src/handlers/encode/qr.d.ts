import {
  APIEncoding,
  APIVersion,
  NetworkType,
  QRTemplateType
} from '../../types'
declare const _default: (args: {
  apiVersion: APIVersion
  network: NetworkType
  encoding: APIEncoding
  input: string
  debug?: boolean
  qrResultType?: 'png' | 'svg'
  outputFile?: string
  template?: QRTemplateType | string
  styles?: string
}) => Promise<string>
export default _default
//# sourceMappingURL=qr.d.ts.map
