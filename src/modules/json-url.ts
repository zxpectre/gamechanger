// export default () => {
//   //This is the right path
//   const isNode = typeof process === 'object' && typeof window !== 'object'
//   const pathStr = isNode ? 'json-url' : 'json-url/dist/browser/json-url-single'
//   console.log(`Trying to import json-url from '${pathStr}'`)
//   //but now dealing with lzma separately( to minimize json-url issues ) is causing some issues on browser, so I give up and disable browser lzw support for now (APIv1).
//   //if (!isNode) throw new Error('Not currently implemented!')
//   return import(pathStr).then((d) => d.default)

//   //This is wrong. When passing hardcoded strings to import(), rollup automatically tries to bundle them, so this code fails because it bundles twice and either nodejs or browser fails
//   //   return isNode
//   //     ? import('json-url').then((d) => d.default)
//   //     : import('json-url/dist/browser/json-url-single').then((d) => d.default)
// }

export default () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  const pathStr = isNode ? 'json-url' : 'json-url/dist/node/browser-index.js' //'json-url/dist/browser/json-url-single.js'
  return import(pathStr).then((jsonUrlLib) => {
    console.log({ jsonUrlLib })
    return jsonUrlLib.default
  })
}
