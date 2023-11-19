import _testDeps from './tests/deps'

import _handlers from './handlers'
import _encodings from './encodings'
import { usageMessage, QRRenderTypes } from './config'

export const encodings = _encodings
export const gc = _handlers
// export const cli =
//   typeof window === 'object'
//     ? undefined
//     : import('./cli.ts.old').then((d) => d.default())
export const config = {
  usageMessage,
  QRRenderTypes
}
export default _handlers

export const testDeps = _testDeps

//TODO: check https://github.com/knightedcodemonkey/duel