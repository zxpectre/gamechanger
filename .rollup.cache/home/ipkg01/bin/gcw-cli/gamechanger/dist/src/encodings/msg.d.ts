import { APIEncoding, EncodingHandler } from '../types'
export declare const msgEncodings: {
  gzip: EncodingHandler
  'json-url-lzma': EncodingHandler
  'json-url-lzw': EncodingHandler
  base64url: EncodingHandler
}
/**
 * Map of encoders and their message headers. Headers are used to auto-detect which decoder needs to be used to decode the message
 *
 * Sorted from worst to best compression for average message bodies
 */
export declare const EncodingByHeaders: {
  [header: string]: APIEncoding
}
/**
 * Map of message headers and their encoders.
 */
export declare const HeadersByEncoders: {
  [encoding: string]: string
}
/**
 * Async loaders for the required encoding handlers, as a map.
 */
export declare const EncodingHandlers: {
  [name: string]: () => Promise<EncodingHandler>
}
declare const handler: EncodingHandler
export default handler
//# sourceMappingURL=msg.d.ts.map
