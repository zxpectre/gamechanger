import { EncodingHandler } from '../types'
import { Buffer } from 'buffer'
import safeJSONStringify from 'json-stringify-safe'
//import URLSafeBase64 from 'urlsafe-base64'
import * as URLSafeBase64 from '../modules/urlsafe-base64'
import pako from 'pako'

// //@typescript-eslint/no-var-requires
// const safeJSONStringify = require('json-stringify-safe'); //dont fail on circular references
// //@typescript-eslint/no-var-requires
// const URLSafeBase64     = require('urlsafe-base64');
// //@typescript-eslint/no-var-requires
// const pako              = require('pako');

const handler: EncodingHandler = {
  name: 'GZip',
  encoder: (obj: any, options?: any) =>
    new Promise(async (resolve, reject) => {
      try {
        // const buffer = await import('buffer').then((d) => d.default)
        // const { Buffer } = buffer
        console.log({ Buffer })
        //const pako = await import('pako').then((d) => d.default)
        //const safeJSONStringify = JSON.stringify
        // await import('json-stringify-safe').then(
        //   (d) => d.default
        // )
        console.log({ Buffer, pako })
        // const URLSafeBase64 = await import('urlsafe-base64').then(
        //   (d) => d.default
        // )
        console.log({ Buffer, safeJSONStringify, URLSafeBase64 })
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
  decoder: (msg: string, options?: any) =>
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
