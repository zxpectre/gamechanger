import _testDeps from './tests/deps'

import _handlers from './handlers'
import _encodings from './encodings'
import { usageMessage } from './config'

export const encodings = _encodings
export const gc = _handlers
// export const cli =
//   typeof window === 'object'
//     ? undefined
//     : import('./cli.ts.old').then((d) => d.default())
export const config = {
  usageMessage
}
export default _handlers

export const testDeps = _testDeps
