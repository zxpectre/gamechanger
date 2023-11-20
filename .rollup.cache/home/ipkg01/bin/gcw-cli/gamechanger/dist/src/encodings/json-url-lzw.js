const handler = {
  name: 'JSON-URL LZW',
  encoder: async (obj /*,_options?:any*/) => {
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.compress(obj)
  },
  decoder: async (msg /*,_options?:any*/) => {
    const jsonUrl = await import('../modules/json-url').then((d) => d.default())
    const lzwCodec = jsonUrl('lzw')
    return lzwCodec.decompress(msg)
  }
}
export default handler
//# sourceMappingURL=json-url-lzw.js.map
