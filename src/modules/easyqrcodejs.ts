import Canvas from 'canvas'
import path from 'path'
import { ObjectType } from '../types'
//import QRCode4Node from 'easyqrcodejs-nodejs'
//import QRCode4Browser from 'easyqrcodejs'
//import { ObjectType } from '../types'

export default async () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  //const useGlobal = isNode ? global : window;

  if (isNode) {
    const _QRCode = await import('easyqrcodejs-nodejs').then((d) => d?.default) //QRCode4Node //require('easyqrcodejs-nodejs')
    //const Canvas = require('canvas') //https://github.com/Automattic/node-canvas
    //const path = require('path')
    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options: ObjectType) => {
      // const canvas = Canvas.createCanvas(width, height)
      // if (!canvas) throw new Error('canvas creation failed on browser')
      return new QRCode(options)
    }
    const renderQRCode = async (args: {
      text: string
      style: any
    }): Promise<any> => {
      return new Promise(async (resolve) => {
        const options = {
          ...(args.style || {}),
          text: args.text
        }
        const qr = createQRCode(options)
        resolve({
          qr,
          qrCodeOptions: options,
          dataURL: await qr.toDataURL(),
          SVGText: await qr.toSVGText()
        })
      })
    }
    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = path.resolve(__dirname, file)
        console.log(
          `Registering font '${fontPath}' (${
            def?.family || 'Unknown'
          }) on NodeJS Canvas...`
        )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          throw new Error(
            `Error registering font '${fontPath}' (${
              def?.family || 'Unknown'
            }) on NodeJS Canvas. ${err}`
          )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }
  } else {
    //const _QRCode = QRCode4Browser //await import('easyqrcodejs-nodejs').then(
    //const _QRCode = await import('easyqrcodejs/dist/easy.qrcode.min.js').then(
    const _QRCode = await import('easyqrcodejs/src/easy.qrcode').then(() => {
      return (<any>window)?.QRCode
    }) //QRCode4Browser //require('easyqrcodejs-nodejs')

    const QRCode = _QRCode //replaceable by a wrapper class
    const createQRCode = (options: ObjectType) => {
      const canvas = document.createElement('canvas') //Canvas.createCanvas(width, height)
      if (!canvas) throw new Error('canvas creation failed on browser')
      return new QRCode(canvas, options)
    }
    const renderQRCode = async (args: {
      text: string
      style: any
    }): Promise<any> => {
      return new Promise(async (resolve) => {
        const qr = createQRCode({
          ...(args.style || {}),
          text: args.text,
          onRenderingEnd: (qrCodeOptions: any, dataURL: string) => {
            console.dir({ dataURL, qrCodeOptions })
            resolve({ qr, qrCodeOptions, dataURL, SVGText: '' })
          }
        })
      })
    }
    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = file
        console.log(
          `Registering font '${fontPath}' (${
            def?.family || 'Unknown'
          }) on NodeJS Canvas...`
        )
        try {
          registerFont(fontPath, def)
        } catch (err) {
          // throw new Error(
          //   `Error registering font '${fontPath}' (${
          //     def?.family || 'Unknown'
          //   }) on NodeJS Canvas. ${err}`
          // )
        }
      })
    }
    return {
      _QRCode,
      QRCode,
      Canvas,
      createQRCode,
      renderQRCode,
      registerFonts
    }
  }
}

//Example wrapper for future reference
// class QRCode extends _QRCode {
//   private _htOption!: ObjectType

//   constructor(options: ObjectType) {
//     //const { width, height } = options
//     console.dir({ options })
//     // const canvas = Canvas.createCanvas(width, height)
//     // console.dir({ Canvas, canvas })
//     // if (!canvas) throw new Error('canvas creation failed on nodejs')
//     super(options)
//     console.dir({ self: this })
//   }

//   changeStyles(styles: ObjectType) {
//     this._htOption = {
//       ...(this._htOption || {}),
//       ...styles
//     }
//   }
// }
