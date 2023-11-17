//import * as lzmaLib from 'lzma/src/lzma_worker-min.js'
//import from 'lzma/src/lzma-min.js'
import 'lzma/src/lzma_worker.js'

export default () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const useGlobal = isNode ? global : window
  const { LZMA, LZMA_WORKER } = <any>useGlobal || {}
  console.log({ LZMA_WORKER, LZMA })
  return LZMA

  //return import('lzma/src/lzma_worker-min.js')
  // console.log({ lzmaLib })
  // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib?.LZMA
  // console.log({ lzmaLib, lzmaCodec })
  // return lzmaCodec
}
// export default () => {
//   //This is the right path
//   const isNode = typeof process === 'object' && typeof window !== 'object'
//   const pathStr = isNode ? 'lzma' : 'lzma/src/lzma_worker-min.js'

//   console.log(`Trying to import lzma from '${pathStr}'...`)
//   return import(pathStr).then((lzmaLib) => {
//     // this special condition is present because the web minified version has a slightly different export
//     const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib?.LZMA
//     console.log({ lzmaLib, lzmaCodec })
//     return lzmaCodec
//   })
// }
