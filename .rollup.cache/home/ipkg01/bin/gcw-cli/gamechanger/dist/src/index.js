import _testDeps from './tests/deps'
import { usageMessage, QRRenderTypes } from './config'
import _handlers from './handlers'
import _encodings from './encodings'
export const encodings = _encodings
export const gc = _handlers
// export const cli =
//   typeof window === 'object'
//     ? undefined
//     : import('./cli.ts.old').then((d) => d.default())
export default _handlers
export const config = {
  usageMessage,
  QRRenderTypes
}
export const testDeps = _testDeps
//TODO: check https://github.com/knightedcodemonkey/duel
//# sourceMappingURL=index.js.map
