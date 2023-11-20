//import path from 'node:path'
//import * as path from 'path'
import { apiEncodings, apiVersions, networks } from '../config'
import {
  DefaultAPIEncodings,
  DefaultAPIVersion,
  DefaultNetwork
} from '../types'
// export const resolveGlobal = async (file) => {
//   //const path = await import('path').then(d=>d.default);
//   var commonjsGlobal =
//     typeof window !== 'undefined'
//       ? window
//       : typeof global !== 'undefined'
//       ? global
//       : this
//   console.log({ path, commonjsGlobal })
//   if (!commonjsGlobal) throw new Error('Missing global')
//   return path.resolve('dist/', file)
// }
export const validateBuildMsgArgs = (args) => {
  const network = args?.network ? args?.network : DefaultNetwork
  if (!networks.includes(network)) {
    throw new Error(`Unknown Cardano network specification '${network || ''}'`)
  }
  const apiVersion = args?.apiVersion ? args?.apiVersion : DefaultAPIVersion
  if (!apiVersions.includes(apiVersion))
    throw new Error(`Unknown API version '${apiVersion || ''}'`)
  const defaultEncoding = DefaultAPIEncodings[apiVersion]
  const encoding = args?.encoding ? args?.encoding : defaultEncoding
  if (!apiEncodings[apiVersion].includes(encoding))
    throw new Error(
      `Unknown encoding '${encoding || ''}' for API version '${
        apiVersion || ''
      }'`
    )
  const input = args?.input
  if (!input) throw new Error('Empty GCScript provided')
  if (typeof input !== 'string')
    throw new Error(
      'Wrong input type. GCScript must be presented as JSON string'
    )
  return {
    apiVersion,
    network,
    encoding,
    input
  }
}
// export const getPlatform = () => {
//   try {
//     // Check if the environment is Node.js
//     if (typeof process === 'object' && typeof require === 'function') {
//       return 'nodejs'
//     }
//   } catch (err) {}
//   // try {
//   //   // Check if the environment is a
//   //   // Service worker
//   //   if (typeof importScripts === 'function') {
//   //     return 'worker'
//   //   }
//   // } catch (err) {}
//   try {
//     // Check if the environment is a Browser
//     if (typeof window === 'object') {
//       return 'browser'
//     }
//   } catch (err) {}
// }
//# sourceMappingURL=index.js.map
