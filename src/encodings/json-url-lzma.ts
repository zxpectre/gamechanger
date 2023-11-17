import { EncodingHandler } from '../types'
import jsonUrl from 'json-url/dist/browser/json-url-single'
const lzmaCodec = jsonUrl('lzma')

const handler: EncodingHandler = {
  name: 'JSON-URL LZMA',
  encoder: (obj: any /*,_options?:any*/) => lzmaCodec.compress(obj),
  decoder: (msg: string /*,_options?:any*/) => lzmaCodec.decompress(msg)
}

export default handler
