import { EncodingHandler } from '../types'
import jsonUrl from 'json-url/dist/browser/json-url-single'
const lzwCodec = jsonUrl('lzw')

const handler: EncodingHandler = {
  name: 'JSON-URL LZW',
  encoder: (obj: any /*,_options?:any*/) => lzwCodec.compress(obj),
  // {
  //   console.log({ Codec, lzwCodec, obj })
  //   return lzwCodec.compress(obj)
  // },
  //require('json-url')('lzw').compress(obj),
  // import('json-url')
  //   .then((d) => d.default('lzw'))
  //   .then((d) => d.compress(obj)),
  decoder: (msg: string /*,_options?:any*/) => lzwCodec.decompress(msg)
  //lzwCodec.decompress(msg)
  //require('json-url')('lzw').decompress(msg)
  // import('json-url')
  //   .then((d) => d.default('lzw'))
  //   .then((d) => d.decompress(msg))
}

export default handler
