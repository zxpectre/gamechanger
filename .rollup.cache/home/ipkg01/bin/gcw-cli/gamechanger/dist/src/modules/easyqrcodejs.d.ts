import Canvas from 'canvas'
import { ObjectType } from '../types'
declare const _default: () => Promise<{
  _QRCode: any
  QRCode: any
  Canvas: typeof Canvas
  createQRCode: (options: ObjectType) => any
  renderQRCode: (args: { text: string; style: any }) => Promise<any>
  registerFonts: (
    items: Array<{
      file: string
      def: any
    }>
  ) => void
}>
export default _default
//# sourceMappingURL=easyqrcodejs.d.ts.map
