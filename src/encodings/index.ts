import gzipEncoding from './gzip'
import jsonUrlLzmaEncoding from './json-url-lzma'
import jsonUrlLzwEncoding from './json-url-lzw'
import base64Encoding from './base64url'
import msgEncoding from './msg'
import urlEncoding from './url'

export default {
  'gzip':gzipEncoding,
  'json-url-lzma':jsonUrlLzmaEncoding,
  'json-url-lzw':jsonUrlLzwEncoding,
  'base64url':base64Encoding,
  'msg':msgEncoding,
  'url':urlEncoding,
}
