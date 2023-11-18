import { Buffer } from 'buffer'
import { EncodingHandler } from '../types'
import urlEncoder from './url'
import { renderQRCode } from '../modules/QR'

const handler: EncodingHandler = {
  name: 'GameChanger Wallet QR transport. The URL transport encoded as QR code',
  encoder: async (
    obj: any,
    options?: { qrCodeStyle?: any; qrResultType?: 'png' | 'svg' }
  ) => {
    const url = await urlEncoder.encoder(obj, options)
    const qr = await renderQRCode({
      text: url,
      style: { ...(options?.qrCodeStyle || {}) }
    })
    const qrResultType = options?.qrResultType || 'png'
    const handlers = {
      png: async (qr) => await qr.toDataURL(),
      svg: async (qr) =>
        `data:image/svg+xml;base64,${Buffer.from(await qr.toSVGText()).toString(
          'base64'
        )}`
    }
    const res = await handlers[qrResultType](qr)
    console.log(qrResultType, res)
    return res
  },
  decoder: async (/*msg: string ,_options?:any*/) => {
    throw new Error('Not implemented yet')
  }
}

export default handler
