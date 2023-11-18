import loader from './easyqrcodejs'
const { QRCode } = loader() //If turns into async, must be moved inside

export const renderQRCode = async (args: {
  text: string
  style: any
}): Promise<typeof QRCode> => {
  return new Promise((resolve) => {
    //registerFont(fontURL, { family: 'Abstract' });
    const qr = new QRCode({
      ...(args.style || {}),
      text: args.text
      //   onRenderingEnd: (qrCodeOptions: any, dataURL: string) => {
      //     console.dir({ dataURL })
      //     resolve({ qr: <any>qr, qrCodeOptions, dataURL })
      //   }
    })
    //const dataURL = qr.toDataURL()
    //console.dir({ dataURL, qr })
    resolve(qr)
  })
}

//KEEP THIS SNIPPET: for creating background for inner QR Logos!
// export const getBackground = async (width: number = size) => {
//   const convert = require('data-uri-to-buffer')

//   const canvas = document.createElement('canvas')
//   const ctx = canvas.getContext('2d')
//   if (ctx) {
//     const container = document.getElementById('gamearea') || document.body

//     container.appendChild(canvas)
//     canvas.width = width
//     canvas.height = width

//     const sp = {
//         x: 0,
//         y: 0
//       },
//       ep = {
//         x: canvas.width,
//         y: 0
//       }

//     const gradient = ctx.createLinearGradient(sp.x, sp.y, ep.x, ep.y)
//     gradient.addColorStop(0, '#1f00ff')
//     gradient.addColorStop(1, '#9800ff')
//     ctx.fillStyle = gradient
//     ctx.fillRect(0, 0, canvas.width, canvas.height)
//     const buffer = await convert(canvas.toDataURL('image/png'))
//     return Promise.resolve(buffer)
//   }
//   return Promise.reject(new Error('Canvas not available'))
// }
