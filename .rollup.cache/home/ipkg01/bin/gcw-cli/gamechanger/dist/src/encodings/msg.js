//import { baseEncodings } from '.'
import { DefaultAPIEncodings, DefaultAPIVersion } from '../types'
import gzipEncoding from './gzip'
import jsonUrlLzmaEncoding from './json-url-lzma'
import jsonUrlLzwEncoding from './json-url-lzw'
import base64Encoding from './base64url'
export const msgEncodings = {
  gzip: gzipEncoding,
  'json-url-lzma': jsonUrlLzmaEncoding,
  'json-url-lzw': jsonUrlLzwEncoding,
  base64url: base64Encoding
}
/**
 * Map of encoders and their message headers. Headers are used to auto-detect which decoder needs to be used to decode the message
 *
 * Sorted from worst to best compression for average message bodies
 */
export const EncodingByHeaders = {
  '0-': 'base64url',
  XQ: 'json-url-lzma',
  wo: 'json-url-lzw',
  '1-': 'gzip' //gc wallet v2
}
/**
 * Map of message headers and their encoders.
 */
export const HeadersByEncoders = Object.fromEntries(
  Object.entries(EncodingByHeaders).map(([header, encoding]) => [
    encoding,
    header
  ])
)
/**
 * Async loaders for the required encoding handlers, as a map.
 */
export const EncodingHandlers = Object.fromEntries(
  Object.keys(HeadersByEncoders).map((encoder) => {
    const loader = () =>
      import(`./${encoder}`).then((module) => module?.default)
    return [encoder, loader]
  })
)
const handler = {
  name: 'Packed GCScript or data message with header',
  encoder: async (obj, options) => {
    const useEncoding =
      options?.encoding || DefaultAPIEncodings[DefaultAPIVersion] // use an specific encoder or use the default one
    // const handlerLoader = EncodingHandlers[useEncoding]
    // if (!handlerLoader) throw new Error('Unknown encoder. Cannot encode')
    const codec = msgEncodings[useEncoding] //await handlerLoader()
    if (!codec) throw new Error('Unknown encoder. Cannot encode')
    const header = HeadersByEncoders[useEncoding]
    if (!header) throw new Error('Unknown encoder header. Cannot encode')
    const msgBody = await codec.encoder(obj, options?.encodingOptions)
    const msg = `${['XQ', 'wo'].includes(header) ? '' : header}${msgBody}` //legacy modes has no added header
    return msg
  },
  decoder: async (msg, options) => {
    if (!msg) throw new Error('Empty data. Cannot decode')
    let detectedEnconding = undefined
    let useHeader = ''
    Object.keys(EncodingByHeaders).forEach((header) => {
      if (!detectedEnconding && msg.startsWith(header)) {
        detectedEnconding = EncodingByHeaders[header]
        useHeader = header
      }
    })
    if (!detectedEnconding)
      throw new Error('Unknown decoder header. Cannot decode')
    if (options?.encoding && detectedEnconding !== options?.encoding)
      throw new Error('Unexpected encoding detected. Cannot decode')
    // const handlerLoader = EncodingHandlers[detectedEnconding]
    // if (!handlerLoader) throw new Error('Unknown decoder. Cannot decode')
    const codec = msgEncodings[detectedEnconding] //await handlerLoader()
    if (!codec) throw new Error('Unknown decoder. Cannot decode')
    const useMsg = !['XQ', 'wo'].includes(useHeader) //legacy modes has no header actually
      ? msg.replace(useHeader, '')
      : msg
    const obj = await codec.decoder(useMsg, options?.encodingOptions)
    return obj
  }
}
export default handler
//# sourceMappingURL=msg.js.map
