import { Buffer } from 'buffer'
import safeJSONStringify from 'json-stringify-safe'
import URLSafeBase64 from 'urlsafe-base64'
import pako from 'pako'
import jsonUrl from 'json-url/dist/browser/json-url-single'
import template from 'string-placeholder'

import logoURL from '../assets/images/dapp-logo-bg.png'
import backgroundURL from '../assets/images/background.png'
import fontURL from '../assets/fonts/ABSTRACT.ttf'

export default async () => {
  console.log({ Buffer })
  console.log({ safeJSONStringify })
  console.log({ safeJSONStringify })
  console.log({ URLSafeBase64 })
  console.log({ pako })
  console.log({ jsonUrl })
  const lzwCodec = jsonUrl('lzw')
  const lzmaCodec = jsonUrl('lzma')
  console.log({ lzwCodec })
  console.log({ lzmaCodec })
  console.log({ template })

  console.log({
    Buffer: Buffer.from('Hello').toString('hex'),
    safeJSONStringify: safeJSONStringify({ foo: 'bar' }),
    URLSafeBase64: URLSafeBase64.encode(Buffer.from('Hello').toString('hex')),
    pako: Buffer.from(
      pako.gzip(Buffer.from(safeJSONStringify({ foo: 'bar' }), 'utf-8'))
    ).toString('hex'),
    lzwCodec: await lzwCodec.compress({ foo: 'bar' }),
    lzmaCodec: await lzmaCodec.compress({ foo: 'bar' }),
    template: template(
      'hello {word}',
      { word: 'world' },
      {
        before: '{',
        after: '}'
      }
    ),
    logoURL, //: await import('./assets/images/dapp-logo-bg.png'),
    backgroundURL, //: await import('./assets/images/background.png')
    fontURL
  })

  return 'OK'
}
