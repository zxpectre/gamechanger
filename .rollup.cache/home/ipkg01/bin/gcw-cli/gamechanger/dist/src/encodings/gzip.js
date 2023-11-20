import { Buffer } from 'buffer'
import safeJSONStringify from 'json-stringify-safe'
import * as URLSafeBase64 from '../modules/urlsafe-base64'
import pako from 'pako'
const handler = {
  name: 'GZip',
  encoder: (obj, options) =>
    new Promise(async (resolve, reject) => {
      try {
        const buff = Buffer.from(
          pako.gzip(
            Buffer.from(safeJSONStringify(obj), 'utf-8'),
            options?.codecOptions || {}
          )
        )
        return resolve(URLSafeBase64.encode(buff))
      } catch (err) {
        return reject(err)
      }
    }),
  decoder: (msg, options) =>
    new Promise(async (resolve, reject) => {
      try {
        //const URLSafeBase64 = require('urlsafe-base64')
        //const pako = await import('pako').then((d) => d.default)
        const buff = Buffer.from(
          pako.ungzip(
            Buffer.from(URLSafeBase64.decode(msg).toString('utf-8'), 'utf-8'),
            options?.codecOptions || {}
          )
        )
        return resolve(JSON.parse(buff.toString('utf-8')))
      } catch (err) {
        return reject(err)
      }
    })
}
export default handler
//# sourceMappingURL=gzip.js.map
