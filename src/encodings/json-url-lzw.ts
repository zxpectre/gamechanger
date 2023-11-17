import { EncodingHandler } from '../types'
//import jsonUrl from 'json-url/dist/browser/json-url-single'
//import jsonUrl from 'json-url/dist/node/loaders'
//import lzwCodec from 'json-url/dist/node/codecs/lzw'
//const lzwCodec = jsonUrl.default('lzw')

const handler: EncodingHandler = {
  name: 'JSON-URL LZW',
  encoder: async (obj: any /*,_options?:any*/) => {
    //const lzwCodec = await import('json-url').then((d) => d.default('json-url'))
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.compress(obj)
  },
  // {
  //   console.log({ Codec, lzwCodec, obj })
  //   return lzwCodec.compress(obj)
  // },
  //require('json-url')('lzw').compress(obj),
  // import('json-url')
  //   .then((d) => d.default('lzw'))
  //   .then((d) => d.compress(obj)),
  decoder: async (msg: string /*,_options?:any*/) => {
    //const lzwCodec = await import('json-url').then((d) => d.default('json-url'))
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.decompress(msg)
  }
  //lzwCodec.decompress(msg)
  //require('json-url')('lzw').decompress(msg)
  // import('json-url')
  //   .then((d) => d.default('lzw'))
  //   .then((d) => d.decompress(msg))
}

export default handler
