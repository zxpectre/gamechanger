import URLEncoder from './url'
import QREncoder from './qr'
import ButtonEncoder from './button'
import HtmlEncoder from './html'
import ReactEncoder from './react'
import ExpressEncoder from './express'

export default {
  url: URLEncoder,
  qr: QREncoder,
  button: ButtonEncoder,
  html: HtmlEncoder,
  express: ExpressEncoder,
  react: ReactEncoder
}
