import { ObjectType } from '../types'
//import Canvas from 'canvas'
import _QRCode from 'easyqrcodejs-nodejs'

export default () => {
  const isNode = typeof process === 'object' && typeof window !== 'object'
  //const useGlobal = isNode ? global : window;

  if (isNode) {
    const _QRCode = require('easyqrcodejs-nodejs')
    const Canvas = require('canvas') //https://github.com/Automattic/node-canvas
    const path = require('path')
    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = path.resolve(__dirname, file)
        console.log(
          `Registering font '${fontPath}' (${
            def?.family || 'Unknown'
          }) on NodeJS Canvas...`
        )
        registerFont(fontPath, def)
      })
    }
    const QRCode = _QRCode //replaceable by a wrapper class
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

    return {
      _QRCode,
      QRCode,
      Canvas,
      registerFonts
    }
  } else {
    //TODO: adapt for browser!
    const _QRCode = require('easyqrcodejs')
    const Canvas = require('canvas')
    const path = require('path')

    const registerFonts = (items: Array<{ file: string; def: any }>) => {
      const { registerFont } = Canvas
      items.forEach(({ file, def }) => {
        const fontPath = path.resolve(__dirname, file)
        registerFont(fontPath, def)
      })
    }
    class QRCode extends _QRCode {
      private _htOption!: ObjectType

      constructor(options: ObjectType) {
        const canvas = document.createElement('canvas')
        super(canvas, options)
      }

      changeStyles(styles: ObjectType) {
        this._htOption = {
          ...(this._htOption || {}),
          ...styles
        }
      }
    }

    return {
      _QRCode,
      QRCode,
      Canvas,
      registerFonts
    }
  }
}
