;(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined'
    ? factory(exports)
    : typeof define === 'function' && define.amd
    ? define(['exports'], factory)
    : ((global =
        typeof globalThis !== 'undefined' ? globalThis : global || self),
      factory((global.window = global.window || {})))
})(this, function (exports) {
  'use strict'

  var global$1 =
    typeof global !== 'undefined'
      ? global
      : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
      ? window
      : {}

  var lookup = []
  var revLookup = []
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array
  var inited = false
  function init() {
    inited = true
    var code =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup[i] = code[i]
      revLookup[code.charCodeAt(i)] = i
    }

    revLookup['-'.charCodeAt(0)] = 62
    revLookup['_'.charCodeAt(0)] = 63
  }

  function toByteArray(b64) {
    if (!inited) {
      init()
    }
    var i, j, l, tmp, placeHolders, arr
    var len = b64.length

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr((len * 3) / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len

    var L = 0

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 18) |
        (revLookup[b64.charCodeAt(i + 1)] << 12) |
        (revLookup[b64.charCodeAt(i + 2)] << 6) |
        revLookup[b64.charCodeAt(i + 3)]
      arr[L++] = (tmp >> 16) & 0xff
      arr[L++] = (tmp >> 8) & 0xff
      arr[L++] = tmp & 0xff
    }

    if (placeHolders === 2) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 2) |
        (revLookup[b64.charCodeAt(i + 1)] >> 4)
      arr[L++] = tmp & 0xff
    } else if (placeHolders === 1) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 10) |
        (revLookup[b64.charCodeAt(i + 1)] << 4) |
        (revLookup[b64.charCodeAt(i + 2)] >> 2)
      arr[L++] = (tmp >> 8) & 0xff
      arr[L++] = tmp & 0xff
    }

    return arr
  }

  function tripletToBase64(num) {
    return (
      lookup[(num >> 18) & 0x3f] +
      lookup[(num >> 12) & 0x3f] +
      lookup[(num >> 6) & 0x3f] +
      lookup[num & 0x3f]
    )
  }

  function encodeChunk(uint8, start, end) {
    var tmp
    var output = []
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2]
      output.push(tripletToBase64(tmp))
    }
    return output.join('')
  }

  function fromByteArray(uint8) {
    if (!inited) {
      init()
    }
    var tmp
    var len = uint8.length
    var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var parts = []
    var maxChunkLength = 16383 // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(
        encodeChunk(
          uint8,
          i,
          i + maxChunkLength > len2 ? len2 : i + maxChunkLength
        )
      )
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1]
      output += lookup[tmp >> 2]
      output += lookup[(tmp << 4) & 0x3f]
      output += '=='
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1]
      output += lookup[tmp >> 10]
      output += lookup[(tmp >> 4) & 0x3f]
      output += lookup[(tmp << 2) & 0x3f]
      output += '='
    }

    parts.push(output)

    return parts.join('')
  }

  function read(buffer, offset, isLE, mLen, nBytes) {
    var e, m
    var eLen = nBytes * 8 - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var nBits = -7
    var i = isLE ? nBytes - 1 : 0
    var d = isLE ? -1 : 1
    var s = buffer[offset + i]

    i += d

    e = s & ((1 << -nBits) - 1)
    s >>= -nBits
    nBits += eLen
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << -nBits) - 1)
    e >>= -nBits
    nBits += mLen
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias
    } else if (e === eMax) {
      return m ? NaN : (s ? -1 : 1) * Infinity
    } else {
      m = m + Math.pow(2, mLen)
      e = e - eBias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  function write(buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c
    var eLen = nBytes * 8 - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0
    var i = isLE ? 0 : nBytes - 1
    var d = isLE ? 1 : -1
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

    value = Math.abs(value)

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0
      e = eMax
    } else {
      e = Math.floor(Math.log(value) / Math.LN2)
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--
        c *= 2
      }
      if (e + eBias >= 1) {
        value += rt / c
      } else {
        value += rt * Math.pow(2, 1 - eBias)
      }
      if (value * c >= 2) {
        e++
        c /= 2
      }

      if (e + eBias >= eMax) {
        m = 0
        e = eMax
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen)
        e = e + eBias
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
        e = 0
      }
    }

    for (
      ;
      mLen >= 8;
      buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8
    ) {}

    e = (e << mLen) | m
    eLen += mLen
    for (
      ;
      eLen > 0;
      buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8
    ) {}

    buffer[offset + i - d] |= s * 128
  }

  var toString$2 = {}.toString

  var isArray =
    Array.isArray ||
    function (arr) {
      return toString$2.call(arr) == '[object Array]'
    }

  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
   * @license  MIT
   */

  var INSPECT_MAX_BYTES = 50

  /**
   * If `Buffer.TYPED_ARRAY_SUPPORT`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (most compatible, even IE6)
   *
   * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
   * Opera 11.6+, iOS 4.2+.
   *
   * Due to various browser bugs, sometimes the Object implementation will be used even
   * when the browser supports typed arrays.
   *
   * Note:
   *
   *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
   *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
   *
   *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
   *
   *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
   *     incorrect length in some situations.

   * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
   * get the Object implementation, which is slower but behaves correctly.
   */
  Buffer$1.TYPED_ARRAY_SUPPORT =
    global$1.TYPED_ARRAY_SUPPORT !== undefined
      ? global$1.TYPED_ARRAY_SUPPORT
      : true

  /*
   * Export kMaxLength after typed array support is determined.
   */
  kMaxLength()

  function kMaxLength() {
    return Buffer$1.TYPED_ARRAY_SUPPORT ? 0x7fffffff : 0x3fffffff
  }

  function createBuffer(that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length)
      that.__proto__ = Buffer$1.prototype
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer$1(length)
      }
      that.length = length
    }

    return that
  }

  /**
   * The Buffer constructor returns instances of `Uint8Array` that have their
   * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
   * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
   * and the `Uint8Array` methods. Square bracket notation works as expected -- it
   * returns a single octet.
   *
   * The `Uint8Array` prototype remains unmodified.
   */

  function Buffer$1(arg, encodingOrOffset, length) {
    if (!Buffer$1.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$1)) {
      return new Buffer$1(arg, encodingOrOffset, length)
    }

    // Common case.
    if (typeof arg === 'number') {
      if (typeof encodingOrOffset === 'string') {
        throw new Error(
          'If encoding is specified then the first argument must be a string'
        )
      }
      return allocUnsafe(this, arg)
    }
    return from(this, arg, encodingOrOffset, length)
  }

  Buffer$1.poolSize = 8192 // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer$1._augment = function (arr) {
    arr.__proto__ = Buffer$1.prototype
    return arr
  }

  function from(that, value, encodingOrOffset, length) {
    if (typeof value === 'number') {
      throw new TypeError('"value" argument must not be a number')
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return fromArrayBuffer(that, value, encodingOrOffset, length)
    }

    if (typeof value === 'string') {
      return fromString(that, value, encodingOrOffset)
    }

    return fromObject(that, value)
  }

  /**
   * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
   * if value is a number.
   * Buffer.from(str[, encoding])
   * Buffer.from(array)
   * Buffer.from(buffer)
   * Buffer.from(arrayBuffer[, byteOffset[, length]])
   **/
  Buffer$1.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  }

  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    Buffer$1.prototype.__proto__ = Uint8Array.prototype
    Buffer$1.__proto__ = Uint8Array
    if (
      typeof Symbol !== 'undefined' &&
      Symbol.species &&
      Buffer$1[Symbol.species] === Buffer$1
    );
  }

  function assertSize(size) {
    if (typeof size !== 'number') {
      throw new TypeError('"size" argument must be a number')
    } else if (size < 0) {
      throw new RangeError('"size" argument must not be negative')
    }
  }

  function alloc(that, size, fill, encoding) {
    assertSize(size)
    if (size <= 0) {
      return createBuffer(that, size)
    }
    if (fill !== undefined) {
      // Only pay attention to encoding if it's a string. This
      // prevents accidentally sending in a number that would
      // be interpretted as a start offset.
      return typeof encoding === 'string'
        ? createBuffer(that, size).fill(fill, encoding)
        : createBuffer(that, size).fill(fill)
    }
    return createBuffer(that, size)
  }

  /**
   * Creates a new filled Buffer instance.
   * alloc(size[, fill[, encoding]])
   **/
  Buffer$1.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  }

  function allocUnsafe(that, size) {
    assertSize(size)
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer$1.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  }
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer$1.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  }

  function fromString(that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8'
    }

    if (!Buffer$1.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength(string, encoding) | 0
    that = createBuffer(that, length)

    var actual = that.write(string, encoding)

    if (actual !== length) {
      // Writing a hex string, for example, that contains invalid characters will
      // cause everything after the first invalid character to be ignored. (e.g.
      // 'abxxcd' will be treated as 'ab')
      that = that.slice(0, actual)
    }

    return that
  }

  function fromArrayLike(that, array) {
    var length = array.length < 0 ? 0 : checked(array.length) | 0
    that = createBuffer(that, length)
    for (var i = 0; i < length; i += 1) {
      that[i] = array[i] & 255
    }
    return that
  }

  function fromArrayBuffer(that, array, byteOffset, length) {
    array.byteLength // this throws if `array` is not a valid ArrayBuffer

    if (byteOffset < 0 || array.byteLength < byteOffset) {
      throw new RangeError("'offset' is out of bounds")
    }

    if (array.byteLength < byteOffset + (length || 0)) {
      throw new RangeError("'length' is out of bounds")
    }

    if (byteOffset === undefined && length === undefined) {
      array = new Uint8Array(array)
    } else if (length === undefined) {
      array = new Uint8Array(array, byteOffset)
    } else {
      array = new Uint8Array(array, byteOffset, length)
    }

    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array
      that.__proto__ = Buffer$1.prototype
    } else {
      // Fallback: Return an object instance of the Buffer class
      that = fromArrayLike(that, array)
    }
    return that
  }

  function fromObject(that, obj) {
    if (internalIsBuffer(obj)) {
      var len = checked(obj.length) | 0
      that = createBuffer(that, len)

      if (that.length === 0) {
        return that
      }

      obj.copy(that, 0, 0, len)
      return that
    }

    if (obj) {
      if (
        (typeof ArrayBuffer !== 'undefined' &&
          obj.buffer instanceof ArrayBuffer) ||
        'length' in obj
      ) {
        if (typeof obj.length !== 'number' || isnan(obj.length)) {
          return createBuffer(that, 0)
        }
        return fromArrayLike(that, obj)
      }

      if (obj.type === 'Buffer' && isArray(obj.data)) {
        return fromArrayLike(that, obj.data)
      }
    }

    throw new TypeError(
      'First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.'
    )
  }

  function checked(length) {
    // Note: cannot use `length < kMaxLength()` here because that fails when
    // length is NaN (which is otherwise coerced to zero.)
    if (length >= kMaxLength()) {
      throw new RangeError(
        'Attempt to allocate Buffer larger than maximum ' +
          'size: 0x' +
          kMaxLength().toString(16) +
          ' bytes'
      )
    }
    return length | 0
  }
  Buffer$1.isBuffer = isBuffer
  function internalIsBuffer(b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer$1.compare = function compare(a, b) {
    if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
      throw new TypeError('Arguments must be Buffers')
    }

    if (a === b) return 0

    var x = a.length
    var y = b.length

    for (var i = 0, len = Math.min(x, y); i < len; ++i) {
      if (a[i] !== b[i]) {
        x = a[i]
        y = b[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  Buffer$1.isEncoding = function isEncoding(encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'latin1':
      case 'binary':
      case 'base64':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  }

  Buffer$1.concat = function concat(list, length) {
    if (!isArray(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer$1.alloc(0)
    }

    var i
    if (length === undefined) {
      length = 0
      for (i = 0; i < list.length; ++i) {
        length += list[i].length
      }
    }

    var buffer = Buffer$1.allocUnsafe(length)
    var pos = 0
    for (i = 0; i < list.length; ++i) {
      var buf = list[i]
      if (!internalIsBuffer(buf)) {
        throw new TypeError('"list" argument must be an Array of Buffers')
      }
      buf.copy(buffer, pos)
      pos += buf.length
    }
    return buffer
  }

  function byteLength(string, encoding) {
    if (internalIsBuffer(string)) {
      return string.length
    }
    if (
      typeof ArrayBuffer !== 'undefined' &&
      typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)
    ) {
      return string.byteLength
    }
    if (typeof string !== 'string') {
      string = '' + string
    }

    var len = string.length
    if (len === 0) return 0

    // Use a for loop to avoid recursion
    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return len
        case 'utf8':
        case 'utf-8':
        case undefined:
          return utf8ToBytes(string).length
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return len * 2
        case 'hex':
          return len >>> 1
        case 'base64':
          return base64ToBytes(string).length
        default:
          if (loweredCase) return utf8ToBytes(string).length // assume utf8
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }
  Buffer$1.byteLength = byteLength

  function slowToString(encoding, start, end) {
    var loweredCase = false

    // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
    // property of a typed array.

    // This behaves neither like String nor Uint8Array in that we set start/end
    // to their upper/lower bounds if the value passed is out of range.
    // undefined is handled specially as per ECMA-262 6th Edition,
    // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
    if (start === undefined || start < 0) {
      start = 0
    }
    // Return early if start > this.length. Done here to prevent potential uint32
    // coercion fail below.
    if (start > this.length) {
      return ''
    }

    if (end === undefined || end > this.length) {
      end = this.length
    }

    if (end <= 0) {
      return ''
    }

    // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
    end >>>= 0
    start >>>= 0

    if (end <= start) {
      return ''
    }

    if (!encoding) encoding = 'utf8'

    while (true) {
      switch (encoding) {
        case 'hex':
          return hexSlice(this, start, end)

        case 'utf8':
        case 'utf-8':
          return utf8Slice(this, start, end)

        case 'ascii':
          return asciiSlice(this, start, end)

        case 'latin1':
        case 'binary':
          return latin1Slice(this, start, end)

        case 'base64':
          return base64Slice(this, start, end)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return utf16leSlice(this, start, end)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = (encoding + '').toLowerCase()
          loweredCase = true
      }
    }
  }

  // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
  // Buffer instances.
  Buffer$1.prototype._isBuffer = true

  function swap(b, n, m) {
    var i = b[n]
    b[n] = b[m]
    b[m] = i
  }

  Buffer$1.prototype.swap16 = function swap16() {
    var len = this.length
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1)
    }
    return this
  }

  Buffer$1.prototype.swap32 = function swap32() {
    var len = this.length
    if (len % 4 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 32-bits')
    }
    for (var i = 0; i < len; i += 4) {
      swap(this, i, i + 3)
      swap(this, i + 1, i + 2)
    }
    return this
  }

  Buffer$1.prototype.swap64 = function swap64() {
    var len = this.length
    if (len % 8 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 64-bits')
    }
    for (var i = 0; i < len; i += 8) {
      swap(this, i, i + 7)
      swap(this, i + 1, i + 6)
      swap(this, i + 2, i + 5)
      swap(this, i + 3, i + 4)
    }
    return this
  }

  Buffer$1.prototype.toString = function toString() {
    var length = this.length | 0
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  }

  Buffer$1.prototype.equals = function equals(b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer$1.compare(this, b) === 0
  }

  Buffer$1.prototype.inspect = function inspect() {
    var str = ''
    var max = INSPECT_MAX_BYTES
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
      if (this.length > max) str += ' ... '
    }
    return '<Buffer ' + str + '>'
  }

  Buffer$1.prototype.compare = function compare(
    target,
    start,
    end,
    thisStart,
    thisEnd
  ) {
    if (!internalIsBuffer(target)) {
      throw new TypeError('Argument must be a Buffer')
    }

    if (start === undefined) {
      start = 0
    }
    if (end === undefined) {
      end = target ? target.length : 0
    }
    if (thisStart === undefined) {
      thisStart = 0
    }
    if (thisEnd === undefined) {
      thisEnd = this.length
    }

    if (
      start < 0 ||
      end > target.length ||
      thisStart < 0 ||
      thisEnd > this.length
    ) {
      throw new RangeError('out of range index')
    }

    if (thisStart >= thisEnd && start >= end) {
      return 0
    }
    if (thisStart >= thisEnd) {
      return -1
    }
    if (start >= end) {
      return 1
    }

    start >>>= 0
    end >>>= 0
    thisStart >>>= 0
    thisEnd >>>= 0

    if (this === target) return 0

    var x = thisEnd - thisStart
    var y = end - start
    var len = Math.min(x, y)

    var thisCopy = this.slice(thisStart, thisEnd)
    var targetCopy = target.slice(start, end)

    for (var i = 0; i < len; ++i) {
      if (thisCopy[i] !== targetCopy[i]) {
        x = thisCopy[i]
        y = targetCopy[i]
        break
      }
    }

    if (x < y) return -1
    if (y < x) return 1
    return 0
  }

  // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
  // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
  //
  // Arguments:
  // - buffer - a Buffer to search
  // - val - a string, Buffer, or number
  // - byteOffset - an index into `buffer`; will be clamped to an int32
  // - encoding - an optional encoding, relevant is val is a string
  // - dir - true for indexOf, false for lastIndexOf
  function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
    // Empty buffer means no match
    if (buffer.length === 0) return -1

    // Normalize byteOffset
    if (typeof byteOffset === 'string') {
      encoding = byteOffset
      byteOffset = 0
    } else if (byteOffset > 0x7fffffff) {
      byteOffset = 0x7fffffff
    } else if (byteOffset < -0x80000000) {
      byteOffset = -0x80000000
    }
    byteOffset = +byteOffset // Coerce to Number.
    if (isNaN(byteOffset)) {
      // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
      byteOffset = dir ? 0 : buffer.length - 1
    }

    // Normalize byteOffset: negative offsets start from the end of the buffer
    if (byteOffset < 0) byteOffset = buffer.length + byteOffset
    if (byteOffset >= buffer.length) {
      if (dir) return -1
      else byteOffset = buffer.length - 1
    } else if (byteOffset < 0) {
      if (dir) byteOffset = 0
      else return -1
    }

    // Normalize val
    if (typeof val === 'string') {
      val = Buffer$1.from(val, encoding)
    }

    // Finally, search either indexOf (if dir is true) or lastIndexOf
    if (internalIsBuffer(val)) {
      // Special case: looking for empty string/buffer always fails
      if (val.length === 0) {
        return -1
      }
      return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
    } else if (typeof val === 'number') {
      val = val & 0xff // Search for a byte value [0-255]
      if (
        Buffer$1.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function'
      ) {
        if (dir) {
          return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
        } else {
          return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
        }
      }
      return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
    }

    throw new TypeError('val must be string, number or Buffer')
  }

  function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
    var indexSize = 1
    var arrLength = arr.length
    var valLength = val.length

    if (encoding !== undefined) {
      encoding = String(encoding).toLowerCase()
      if (
        encoding === 'ucs2' ||
        encoding === 'ucs-2' ||
        encoding === 'utf16le' ||
        encoding === 'utf-16le'
      ) {
        if (arr.length < 2 || val.length < 2) {
          return -1
        }
        indexSize = 2
        arrLength /= 2
        valLength /= 2
        byteOffset /= 2
      }
    }

    function read(buf, i) {
      if (indexSize === 1) {
        return buf[i]
      } else {
        return buf.readUInt16BE(i * indexSize)
      }
    }

    var i
    if (dir) {
      var foundIndex = -1
      for (i = byteOffset; i < arrLength; i++) {
        if (
          read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)
        ) {
          if (foundIndex === -1) foundIndex = i
          if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
        } else {
          if (foundIndex !== -1) i -= i - foundIndex
          foundIndex = -1
        }
      }
    } else {
      if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
      for (i = byteOffset; i >= 0; i--) {
        var found = true
        for (var j = 0; j < valLength; j++) {
          if (read(arr, i + j) !== read(val, j)) {
            found = false
            break
          }
        }
        if (found) return i
      }
    }

    return -1
  }

  Buffer$1.prototype.includes = function includes(val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  }

  Buffer$1.prototype.indexOf = function indexOf(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  }

  Buffer$1.prototype.lastIndexOf = function lastIndexOf(
    val,
    byteOffset,
    encoding
  ) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
  }

  function hexWrite(buf, string, offset, length) {
    offset = Number(offset) || 0
    var remaining = buf.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }

    // must be an even number of digits
    var strLen = string.length
    if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2
    }
    for (var i = 0; i < length; ++i) {
      var parsed = parseInt(string.substr(i * 2, 2), 16)
      if (isNaN(parsed)) return i
      buf[offset + i] = parsed
    }
    return i
  }

  function utf8Write(buf, string, offset, length) {
    return blitBuffer(
      utf8ToBytes(string, buf.length - offset),
      buf,
      offset,
      length
    )
  }

  function asciiWrite(buf, string, offset, length) {
    return blitBuffer(asciiToBytes(string), buf, offset, length)
  }

  function latin1Write(buf, string, offset, length) {
    return asciiWrite(buf, string, offset, length)
  }

  function base64Write(buf, string, offset, length) {
    return blitBuffer(base64ToBytes(string), buf, offset, length)
  }

  function ucs2Write(buf, string, offset, length) {
    return blitBuffer(
      utf16leToBytes(string, buf.length - offset),
      buf,
      offset,
      length
    )
  }

  Buffer$1.prototype.write = function write(string, offset, length, encoding) {
    // Buffer#write(string)
    if (offset === undefined) {
      encoding = 'utf8'
      length = this.length
      offset = 0
      // Buffer#write(string, encoding)
    } else if (length === undefined && typeof offset === 'string') {
      encoding = offset
      length = this.length
      offset = 0
      // Buffer#write(string, offset[, length][, encoding])
    } else if (isFinite(offset)) {
      offset = offset | 0
      if (isFinite(length)) {
        length = length | 0
        if (encoding === undefined) encoding = 'utf8'
      } else {
        encoding = length
        length = undefined
      }
      // legacy write(string, encoding, offset, length) - remove in v0.13
    } else {
      throw new Error(
        'Buffer.write(string, encoding, offset[, length]) is no longer supported'
      )
    }

    var remaining = this.length - offset
    if (length === undefined || length > remaining) length = remaining

    if (
      (string.length > 0 && (length < 0 || offset < 0)) ||
      offset > this.length
    ) {
      throw new RangeError('Attempt to write outside buffer bounds')
    }

    if (!encoding) encoding = 'utf8'

    var loweredCase = false
    for (;;) {
      switch (encoding) {
        case 'hex':
          return hexWrite(this, string, offset, length)

        case 'utf8':
        case 'utf-8':
          return utf8Write(this, string, offset, length)

        case 'ascii':
          return asciiWrite(this, string, offset, length)

        case 'latin1':
        case 'binary':
          return latin1Write(this, string, offset, length)

        case 'base64':
          // Warning: maxLength not taken into account in base64Write
          return base64Write(this, string, offset, length)

        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return ucs2Write(this, string, offset, length)

        default:
          if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
          encoding = ('' + encoding).toLowerCase()
          loweredCase = true
      }
    }
  }

  Buffer$1.prototype.toJSON = function toJSON() {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  }

  function base64Slice(buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray(buf)
    } else {
      return fromByteArray(buf.slice(start, end))
    }
  }

  function utf8Slice(buf, start, end) {
    end = Math.min(buf.length, end)
    var res = []

    var i = start
    while (i < end) {
      var firstByte = buf[i]
      var codePoint = null
      var bytesPerSequence =
        firstByte > 0xef ? 4 : firstByte > 0xdf ? 3 : firstByte > 0xbf ? 2 : 1

      if (i + bytesPerSequence <= end) {
        var secondByte, thirdByte, fourthByte, tempCodePoint

        switch (bytesPerSequence) {
          case 1:
            if (firstByte < 0x80) {
              codePoint = firstByte
            }
            break
          case 2:
            secondByte = buf[i + 1]
            if ((secondByte & 0xc0) === 0x80) {
              tempCodePoint = ((firstByte & 0x1f) << 0x6) | (secondByte & 0x3f)
              if (tempCodePoint > 0x7f) {
                codePoint = tempCodePoint
              }
            }
            break
          case 3:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            if ((secondByte & 0xc0) === 0x80 && (thirdByte & 0xc0) === 0x80) {
              tempCodePoint =
                ((firstByte & 0xf) << 0xc) |
                ((secondByte & 0x3f) << 0x6) |
                (thirdByte & 0x3f)
              if (
                tempCodePoint > 0x7ff &&
                (tempCodePoint < 0xd800 || tempCodePoint > 0xdfff)
              ) {
                codePoint = tempCodePoint
              }
            }
            break
          case 4:
            secondByte = buf[i + 1]
            thirdByte = buf[i + 2]
            fourthByte = buf[i + 3]
            if (
              (secondByte & 0xc0) === 0x80 &&
              (thirdByte & 0xc0) === 0x80 &&
              (fourthByte & 0xc0) === 0x80
            ) {
              tempCodePoint =
                ((firstByte & 0xf) << 0x12) |
                ((secondByte & 0x3f) << 0xc) |
                ((thirdByte & 0x3f) << 0x6) |
                (fourthByte & 0x3f)
              if (tempCodePoint > 0xffff && tempCodePoint < 0x110000) {
                codePoint = tempCodePoint
              }
            }
        }
      }

      if (codePoint === null) {
        // we did not generate a valid codePoint so insert a
        // replacement char (U+FFFD) and advance only 1 byte
        codePoint = 0xfffd
        bytesPerSequence = 1
      } else if (codePoint > 0xffff) {
        // encode to utf16 (surrogate pair dance)
        codePoint -= 0x10000
        res.push(((codePoint >>> 10) & 0x3ff) | 0xd800)
        codePoint = 0xdc00 | (codePoint & 0x3ff)
      }

      res.push(codePoint)
      i += bytesPerSequence
    }

    return decodeCodePointsArray(res)
  }

  // Based on http://stackoverflow.com/a/22747272/680742, the browser with
  // the lowest limit is Chrome, with 0x10000 args.
  // We go 1 magnitude less, for safety
  var MAX_ARGUMENTS_LENGTH = 0x1000

  function decodeCodePointsArray(codePoints) {
    var len = codePoints.length
    if (len <= MAX_ARGUMENTS_LENGTH) {
      return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
    }

    // Decode in chunks to avoid "call stack size exceeded".
    var res = ''
    var i = 0
    while (i < len) {
      res += String.fromCharCode.apply(
        String,
        codePoints.slice(i, (i += MAX_ARGUMENTS_LENGTH))
      )
    }
    return res
  }

  function asciiSlice(buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i] & 0x7f)
    }
    return ret
  }

  function latin1Slice(buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; ++i) {
      ret += String.fromCharCode(buf[i])
    }
    return ret
  }

  function hexSlice(buf, start, end) {
    var len = buf.length

    if (!start || start < 0) start = 0
    if (!end || end < 0 || end > len) end = len

    var out = ''
    for (var i = start; i < end; ++i) {
      out += toHex(buf[i])
    }
    return out
  }

  function utf16leSlice(buf, start, end) {
    var bytes = buf.slice(start, end)
    var res = ''
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
    }
    return res
  }

  Buffer$1.prototype.slice = function slice(start, end) {
    var len = this.length
    start = ~~start
    end = end === undefined ? len : ~~end

    if (start < 0) {
      start += len
      if (start < 0) start = 0
    } else if (start > len) {
      start = len
    }

    if (end < 0) {
      end += len
      if (end < 0) end = 0
    } else if (end > len) {
      end = len
    }

    if (end < start) end = start

    var newBuf
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end)
      newBuf.__proto__ = Buffer$1.prototype
    } else {
      var sliceLen = end - start
      newBuf = new Buffer$1(sliceLen, undefined)
      for (var i = 0; i < sliceLen; ++i) {
        newBuf[i] = this[i + start]
      }
    }

    return newBuf
  }

  /*
   * Need to make sure that buffer isn't trying to write out of bounds.
   */
  function checkOffset(offset, ext, length) {
    if (offset % 1 !== 0 || offset < 0)
      throw new RangeError('offset is not uint')
    if (offset + ext > length)
      throw new RangeError('Trying to access beyond buffer length')
  }

  Buffer$1.prototype.readUIntLE = function readUIntLE(
    offset,
    byteLength,
    noAssert
  ) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }

    return val
  }

  Buffer$1.prototype.readUIntBE = function readUIntBE(
    offset,
    byteLength,
    noAssert
  ) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      checkOffset(offset, byteLength, this.length)
    }

    var val = this[offset + --byteLength]
    var mul = 1
    while (byteLength > 0 && (mul *= 0x100)) {
      val += this[offset + --byteLength] * mul
    }

    return val
  }

  Buffer$1.prototype.readUInt8 = function readUInt8(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length)
    return this[offset]
  }

  Buffer$1.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    return this[offset] | (this[offset + 1] << 8)
  }

  Buffer$1.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    return (this[offset] << 8) | this[offset + 1]
  }

  Buffer$1.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (
      (this[offset] | (this[offset + 1] << 8) | (this[offset + 2] << 16)) +
      this[offset + 3] * 0x1000000
    )
  }

  Buffer$1.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (
      this[offset] * 0x1000000 +
      ((this[offset + 1] << 16) | (this[offset + 2] << 8) | this[offset + 3])
    )
  }

  Buffer$1.prototype.readIntLE = function readIntLE(
    offset,
    byteLength,
    noAssert
  ) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var val = this[offset]
    var mul = 1
    var i = 0
    while (++i < byteLength && (mul *= 0x100)) {
      val += this[offset + i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer$1.prototype.readIntBE = function readIntBE(
    offset,
    byteLength,
    noAssert
  ) {
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) checkOffset(offset, byteLength, this.length)

    var i = byteLength
    var mul = 1
    var val = this[offset + --i]
    while (i > 0 && (mul *= 0x100)) {
      val += this[offset + --i] * mul
    }
    mul *= 0x80

    if (val >= mul) val -= Math.pow(2, 8 * byteLength)

    return val
  }

  Buffer$1.prototype.readInt8 = function readInt8(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length)
    if (!(this[offset] & 0x80)) return this[offset]
    return (0xff - this[offset] + 1) * -1
  }

  Buffer$1.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset] | (this[offset + 1] << 8)
    return val & 0x8000 ? val | 0xffff0000 : val
  }

  Buffer$1.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length)
    var val = this[offset + 1] | (this[offset] << 8)
    return val & 0x8000 ? val | 0xffff0000 : val
  }

  Buffer$1.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (
      this[offset] |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
    )
  }

  Buffer$1.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)

    return (
      (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3]
    )
  }

  Buffer$1.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)
    return read(this, offset, true, 23, 4)
  }

  Buffer$1.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length)
    return read(this, offset, false, 23, 4)
  }

  Buffer$1.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length)
    return read(this, offset, true, 52, 8)
  }

  Buffer$1.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length)
    return read(this, offset, false, 52, 8)
  }

  function checkInt(buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf))
      throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min)
      throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer$1.prototype.writeUIntLE = function writeUIntLE(
    value,
    offset,
    byteLength,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var mul = 1
    var i = 0
    this[offset] = value & 0xff
    while (++i < byteLength && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xff
    }

    return offset + byteLength
  }

  Buffer$1.prototype.writeUIntBE = function writeUIntBE(
    value,
    offset,
    byteLength,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    byteLength = byteLength | 0
    if (!noAssert) {
      var maxBytes = Math.pow(2, 8 * byteLength) - 1
      checkInt(this, value, offset, byteLength, maxBytes, 0)
    }

    var i = byteLength - 1
    var mul = 1
    this[offset + i] = value & 0xff
    while (--i >= 0 && (mul *= 0x100)) {
      this[offset + i] = (value / mul) & 0xff
    }

    return offset + byteLength
  }

  Buffer$1.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
    this[offset] = value & 0xff
    return offset + 1
  }

  function objectWriteUInt16(buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffff + value + 1
    for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
      buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        ((littleEndian ? i : 1 - i) * 8)
    }
  }

  Buffer$1.prototype.writeUInt16LE = function writeUInt16LE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff
      this[offset + 1] = value >>> 8
    } else {
      objectWriteUInt16(this, value, offset, true)
    }
    return offset + 2
  }

  Buffer$1.prototype.writeUInt16BE = function writeUInt16BE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 8
      this[offset + 1] = value & 0xff
    } else {
      objectWriteUInt16(this, value, offset, false)
    }
    return offset + 2
  }

  function objectWriteUInt32(buf, value, offset, littleEndian) {
    if (value < 0) value = 0xffffffff + value + 1
    for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
      buf[offset + i] = (value >>> ((littleEndian ? i : 3 - i) * 8)) & 0xff
    }
  }

  Buffer$1.prototype.writeUInt32LE = function writeUInt32LE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = value >>> 24
      this[offset + 2] = value >>> 16
      this[offset + 1] = value >>> 8
      this[offset] = value & 0xff
    } else {
      objectWriteUInt32(this, value, offset, true)
    }
    return offset + 4
  }

  Buffer$1.prototype.writeUInt32BE = function writeUInt32BE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 24
      this[offset + 1] = value >>> 16
      this[offset + 2] = value >>> 8
      this[offset + 3] = value & 0xff
    } else {
      objectWriteUInt32(this, value, offset, false)
    }
    return offset + 4
  }

  Buffer$1.prototype.writeIntLE = function writeIntLE(
    value,
    offset,
    byteLength,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = 0
    var mul = 1
    var sub = 0
    this[offset] = value & 0xff
    while (++i < byteLength && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
        sub = 1
      }
      this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
    }

    return offset + byteLength
  }

  Buffer$1.prototype.writeIntBE = function writeIntBE(
    value,
    offset,
    byteLength,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) {
      var limit = Math.pow(2, 8 * byteLength - 1)

      checkInt(this, value, offset, byteLength, limit - 1, -limit)
    }

    var i = byteLength - 1
    var mul = 1
    var sub = 0
    this[offset + i] = value & 0xff
    while (--i >= 0 && (mul *= 0x100)) {
      if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
        sub = 1
      }
      this[offset + i] = (((value / mul) >> 0) - sub) & 0xff
    }

    return offset + byteLength
  }

  Buffer$1.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
    if (value < 0) value = 0xff + value + 1
    this[offset] = value & 0xff
    return offset + 1
  }

  Buffer$1.prototype.writeInt16LE = function writeInt16LE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff
      this[offset + 1] = value >>> 8
    } else {
      objectWriteUInt16(this, value, offset, true)
    }
    return offset + 2
  }

  Buffer$1.prototype.writeInt16BE = function writeInt16BE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 8
      this[offset + 1] = value & 0xff
    } else {
      objectWriteUInt16(this, value, offset, false)
    }
    return offset + 2
  }

  Buffer$1.prototype.writeInt32LE = function writeInt32LE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value & 0xff
      this[offset + 1] = value >>> 8
      this[offset + 2] = value >>> 16
      this[offset + 3] = value >>> 24
    } else {
      objectWriteUInt32(this, value, offset, true)
    }
    return offset + 4
  }

  Buffer$1.prototype.writeInt32BE = function writeInt32BE(
    value,
    offset,
    noAssert
  ) {
    value = +value
    offset = offset | 0
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
    if (value < 0) value = 0xffffffff + value + 1
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = value >>> 24
      this[offset + 1] = value >>> 16
      this[offset + 2] = value >>> 8
      this[offset + 3] = value & 0xff
    } else {
      objectWriteUInt32(this, value, offset, false)
    }
    return offset + 4
  }

  function checkIEEE754(buf, value, offset, ext, max, min) {
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
    if (offset < 0) throw new RangeError('Index out of range')
  }

  function writeFloat(buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 4)
    }
    write(buf, value, offset, littleEndian, 23, 4)
    return offset + 4
  }

  Buffer$1.prototype.writeFloatLE = function writeFloatLE(
    value,
    offset,
    noAssert
  ) {
    return writeFloat(this, value, offset, true, noAssert)
  }

  Buffer$1.prototype.writeFloatBE = function writeFloatBE(
    value,
    offset,
    noAssert
  ) {
    return writeFloat(this, value, offset, false, noAssert)
  }

  function writeDouble(buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8)
    }
    write(buf, value, offset, littleEndian, 52, 8)
    return offset + 8
  }

  Buffer$1.prototype.writeDoubleLE = function writeDoubleLE(
    value,
    offset,
    noAssert
  ) {
    return writeDouble(this, value, offset, true, noAssert)
  }

  Buffer$1.prototype.writeDoubleBE = function writeDoubleBE(
    value,
    offset,
    noAssert
  ) {
    return writeDouble(this, value, offset, false, noAssert)
  }

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer$1.prototype.copy = function copy(target, targetStart, start, end) {
    if (!start) start = 0
    if (!end && end !== 0) end = this.length
    if (targetStart >= target.length) targetStart = target.length
    if (!targetStart) targetStart = 0
    if (end > 0 && end < start) end = start

    // Copy 0 bytes; we're done
    if (end === start) return 0
    if (target.length === 0 || this.length === 0) return 0

    // Fatal error conditions
    if (targetStart < 0) {
      throw new RangeError('targetStart out of bounds')
    }
    if (start < 0 || start >= this.length)
      throw new RangeError('sourceStart out of bounds')
    if (end < 0) throw new RangeError('sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length) end = this.length
    if (target.length - targetStart < end - start) {
      end = target.length - targetStart + start
    }

    var len = end - start
    var i

    if (this === target && start < targetStart && targetStart < end) {
      // descending copy from end
      for (i = len - 1; i >= 0; --i) {
        target[i + targetStart] = this[i + start]
      }
    } else if (len < 1000 || !Buffer$1.TYPED_ARRAY_SUPPORT) {
      // ascending copy from start
      for (i = 0; i < len; ++i) {
        target[i + targetStart] = this[i + start]
      }
    } else {
      Uint8Array.prototype.set.call(
        target,
        this.subarray(start, start + len),
        targetStart
      )
    }

    return len
  }

  // Usage:
  //    buffer.fill(number[, offset[, end]])
  //    buffer.fill(buffer[, offset[, end]])
  //    buffer.fill(string[, offset[, end]][, encoding])
  Buffer$1.prototype.fill = function fill(val, start, end, encoding) {
    // Handle string cases:
    if (typeof val === 'string') {
      if (typeof start === 'string') {
        encoding = start
        start = 0
        end = this.length
      } else if (typeof end === 'string') {
        encoding = end
        end = this.length
      }
      if (val.length === 1) {
        var code = val.charCodeAt(0)
        if (code < 256) {
          val = code
        }
      }
      if (encoding !== undefined && typeof encoding !== 'string') {
        throw new TypeError('encoding must be a string')
      }
      if (typeof encoding === 'string' && !Buffer$1.isEncoding(encoding)) {
        throw new TypeError('Unknown encoding: ' + encoding)
      }
    } else if (typeof val === 'number') {
      val = val & 255
    }

    // Invalid ranges are not set to a default, so can range check early.
    if (start < 0 || this.length < start || this.length < end) {
      throw new RangeError('Out of range index')
    }

    if (end <= start) {
      return this
    }

    start = start >>> 0
    end = end === undefined ? this.length : end >>> 0

    if (!val) val = 0

    var i
    if (typeof val === 'number') {
      for (i = start; i < end; ++i) {
        this[i] = val
      }
    } else {
      var bytes = internalIsBuffer(val)
        ? val
        : utf8ToBytes(new Buffer$1(val, encoding).toString())
      var len = bytes.length
      for (i = 0; i < end - start; ++i) {
        this[i + start] = bytes[i % len]
      }
    }

    return this
  }

  // HELPER FUNCTIONS
  // ================

  var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

  function base64clean(str) {
    // Node strips out invalid characters like \n and \t from the string, base64-js does not
    str = stringtrim(str).replace(INVALID_BASE64_RE, '')
    // Node converts strings with length < 2 to ''
    if (str.length < 2) return ''
    // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
    while (str.length % 4 !== 0) {
      str = str + '='
    }
    return str
  }

  function stringtrim(str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  function toHex(n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes(string, units) {
    units = units || Infinity
    var codePoint
    var length = string.length
    var leadSurrogate = null
    var bytes = []

    for (var i = 0; i < length; ++i) {
      codePoint = string.charCodeAt(i)

      // is surrogate component
      if (codePoint > 0xd7ff && codePoint < 0xe000) {
        // last char was a lead
        if (!leadSurrogate) {
          // no lead yet
          if (codePoint > 0xdbff) {
            // unexpected trail
            if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
            continue
          } else if (i + 1 === length) {
            // unpaired lead
            if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
            continue
          }

          // valid lead
          leadSurrogate = codePoint

          continue
        }

        // 2 leads in a row
        if (codePoint < 0xdc00) {
          if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        codePoint =
          (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000
      } else if (leadSurrogate) {
        // valid bmp char, but last char was a lead
        if ((units -= 3) > -1) bytes.push(0xef, 0xbf, 0xbd)
      }

      leadSurrogate = null

      // encode utf8
      if (codePoint < 0x80) {
        if ((units -= 1) < 0) break
        bytes.push(codePoint)
      } else if (codePoint < 0x800) {
        if ((units -= 2) < 0) break
        bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80)
      } else if (codePoint < 0x10000) {
        if ((units -= 3) < 0) break
        bytes.push(
          (codePoint >> 0xc) | 0xe0,
          ((codePoint >> 0x6) & 0x3f) | 0x80,
          (codePoint & 0x3f) | 0x80
        )
      } else if (codePoint < 0x110000) {
        if ((units -= 4) < 0) break
        bytes.push(
          (codePoint >> 0x12) | 0xf0,
          ((codePoint >> 0xc) & 0x3f) | 0x80,
          ((codePoint >> 0x6) & 0x3f) | 0x80,
          (codePoint & 0x3f) | 0x80
        )
      } else {
        throw new Error('Invalid code point')
      }
    }

    return bytes
  }

  function asciiToBytes(str) {
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xff)
    }
    return byteArray
  }

  function utf16leToBytes(str, units) {
    var c, hi, lo
    var byteArray = []
    for (var i = 0; i < str.length; ++i) {
      if ((units -= 2) < 0) break

      c = str.charCodeAt(i)
      hi = c >> 8
      lo = c % 256
      byteArray.push(lo)
      byteArray.push(hi)
    }

    return byteArray
  }

  function base64ToBytes(str) {
    return toByteArray(base64clean(str))
  }

  function blitBuffer(src, dst, offset, length) {
    for (var i = 0; i < length; ++i) {
      if (i + offset >= dst.length || i >= src.length) break
      dst[i + offset] = src[i]
    }
    return i
  }

  function isnan(val) {
    return val !== val // eslint-disable-line no-self-compare
  }

  // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
  // The _isBuffer check is for Safari 5-7 support, because it's missing
  // Object.prototype.constructor. Remove this eventually
  function isBuffer(obj) {
    return (
      obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
    )
  }

  function isFastBuffer(obj) {
    return (
      !!obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj)
    )
  }

  // For Node v0.10 support. Remove this eventually.
  function isSlowBuffer(obj) {
    return (
      typeof obj.readFloatLE === 'function' &&
      typeof obj.slice === 'function' &&
      isFastBuffer(obj.slice(0, 0))
    )
  }

  var commonjsGlobal =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : typeof self !== 'undefined'
      ? self
      : {}

  function getDefaultExportFromCjs(x) {
    return x &&
      x.__esModule &&
      Object.prototype.hasOwnProperty.call(x, 'default')
      ? x['default']
      : x
  }

  var stringify = { exports: {} }

  ;(function (module, exports) {
    exports = module.exports = stringify
    exports.getSerialize = serializer

    function stringify(obj, replacer, spaces, cycleReplacer) {
      return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
    }

    function serializer(replacer, cycleReplacer) {
      var stack = [],
        keys = []

      if (cycleReplacer == null)
        cycleReplacer = function (key, value) {
          if (stack[0] === value) return '[Circular ~]'
          return (
            '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']'
          )
        }

      return function (key, value) {
        if (stack.length > 0) {
          var thisPos = stack.indexOf(this)
          ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
          ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
          if (~stack.indexOf(value))
            value = cycleReplacer.call(this, key, value)
        } else stack.push(value)

        return replacer == null ? value : replacer.call(this, key, value)
      }
    }
  })(stringify, stringify.exports)

  var stringifyExports = stringify.exports
  var safeJSONStringify =
    /*@__PURE__*/ getDefaultExportFromCjs(stringifyExports)

  /**
   * Based on urlsafe-base64, on version:
   */
  const version = '1.0.0'
  /**
   * .encode
   *
   * return an encoded Buffer as URL Safe Base64
   *
   * Note: This function encodes to the RFC 4648 Spec where '+' is encoded
   *       as '-' and '/' is encoded as '_'. The padding character '=' is
   *       removed.
   *
   * @param {Buffer} buffer
   * @return {String}
   * @api public
   */
  function encode$1(buffer) {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-') // Convert '+' to '-'
      .replace(/\//g, '_') // Convert '/' to '_'
      .replace(/=+$/, '') // Remove ending '='
  }
  /**
   * .decode
   *
   * return an decoded URL Safe Base64 as Buffer
   *
   * @param {String}
   * @return {Buffer}
   * @api public
   */
  function decode(base64) {
    // Add removed at end '='
    base64 += Array(5 - (base64.length % 4)).join('=')
    base64 = base64
      .replace(/\-/g, '+') // Convert '-' to '+'
      .replace(/\_/g, '/') // Convert '_' to '/'
    return new Buffer(base64, 'base64')
  }
  /**
   * .validate
   *
   * Validates a string if it is URL Safe Base64 encoded.
   *
   * @param {String}
   * @return {Boolean}
   * @api public
   */
  function validate(base64) {
    return /^[A-Za-z0-9\-_]+$/.test(base64)
  }

  var URLSafeBase64 = /*#__PURE__*/ Object.freeze({
    __proto__: null,
    decode: decode,
    encode: encode$1,
    validate: validate,
    version: version
  })

  /*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) */
  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  /* eslint-disable space-unary-ops */

  /* Public constants ==========================================================*/
  /* ===========================================================================*/

  //const Z_FILTERED          = 1;
  //const Z_HUFFMAN_ONLY      = 2;
  //const Z_RLE               = 3;
  const Z_FIXED$1 = 4
  //const Z_DEFAULT_STRATEGY  = 0;

  /* Possible values of the data_type field (though see inflate()) */
  const Z_BINARY = 0
  const Z_TEXT = 1
  //const Z_ASCII             = 1; // = Z_TEXT
  const Z_UNKNOWN$1 = 2

  /*============================================================================*/

  function zero$1(buf) {
    let len = buf.length
    while (--len >= 0) {
      buf[len] = 0
    }
  }

  // From zutil.h

  const STORED_BLOCK = 0
  const STATIC_TREES = 1
  const DYN_TREES = 2
  /* The three kinds of block type */

  const MIN_MATCH$1 = 3
  const MAX_MATCH$1 = 258
  /* The minimum and maximum match lengths */

  // From deflate.h
  /* ===========================================================================
   * Internal compression state.
   */

  const LENGTH_CODES$1 = 29
  /* number of length codes, not counting the special END_BLOCK code */

  const LITERALS$1 = 256
  /* number of literal bytes 0..255 */

  const L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1
  /* number of Literal or Length codes, including the END_BLOCK code */

  const D_CODES$1 = 30
  /* number of distance codes */

  const BL_CODES$1 = 19
  /* number of codes used to transfer the bit lengths */

  const HEAP_SIZE$1 = 2 * L_CODES$1 + 1
  /* maximum heap size */

  const MAX_BITS$1 = 15
  /* All codes must not exceed MAX_BITS bits */

  const Buf_size = 16
  /* size of bit buffer in bi_buf */

  /* ===========================================================================
   * Constants
   */

  const MAX_BL_BITS = 7
  /* Bit length codes must not exceed MAX_BL_BITS bits */

  const END_BLOCK = 256
  /* end of block literal code */

  const REP_3_6 = 16
  /* repeat previous bit length 3-6 times (2 bits of repeat count) */

  const REPZ_3_10 = 17
  /* repeat a zero length 3-10 times  (3 bits of repeat count) */

  const REPZ_11_138 = 18
  /* repeat a zero length 11-138 times  (7 bits of repeat count) */

  /* eslint-disable comma-spacing,array-bracket-spacing */
  const extra_lbits =
    /* extra bits for each length code */
    new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5,
      5, 5, 5, 0
    ])

  const extra_dbits =
    /* extra bits for each distance code */
    new Uint8Array([
      0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10,
      11, 11, 12, 12, 13, 13
    ])

  const extra_blbits =
    /* extra bits for each bit length code */
    new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7])

  const bl_order = new Uint8Array([
    16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
  ])
  /* eslint-enable comma-spacing,array-bracket-spacing */

  /* The lengths of the bit length codes are sent in order of decreasing
   * probability, to avoid transmitting the lengths for unused bit length codes.
   */

  /* ===========================================================================
   * Local data. These are initialized only once.
   */

  // We pre-fill arrays with 0 to avoid uninitialized gaps

  const DIST_CODE_LEN = 512 /* see definition of array dist_code below */

  // !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
  const static_ltree = new Array((L_CODES$1 + 2) * 2)
  zero$1(static_ltree)
  /* The static literal tree. Since the bit lengths are imposed, there is no
   * need for the L_CODES extra codes used during heap construction. However
   * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
   * below).
   */

  const static_dtree = new Array(D_CODES$1 * 2)
  zero$1(static_dtree)
  /* The static distance tree. (Actually a trivial tree since all codes use
   * 5 bits.)
   */

  const _dist_code = new Array(DIST_CODE_LEN)
  zero$1(_dist_code)
  /* Distance codes. The first 256 values correspond to the distances
   * 3 .. 258, the last 256 values correspond to the top 8 bits of
   * the 15 bit distances.
   */

  const _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1)
  zero$1(_length_code)
  /* length code for each normalized match length (0 == MIN_MATCH) */

  const base_length = new Array(LENGTH_CODES$1)
  zero$1(base_length)
  /* First normalized length for each code (0 = MIN_MATCH) */

  const base_dist = new Array(D_CODES$1)
  zero$1(base_dist)
  /* First normalized distance for each code (0 = distance of 1) */

  function StaticTreeDesc(
    static_tree,
    extra_bits,
    extra_base,
    elems,
    max_length
  ) {
    this.static_tree = static_tree /* static tree or NULL */
    this.extra_bits = extra_bits /* extra bits for each code or NULL */
    this.extra_base = extra_base /* base index for extra_bits */
    this.elems = elems /* max number of elements in the tree */
    this.max_length = max_length /* max bit length for the codes */

    // show if `static_tree` has data or dummy - needed for monomorphic objects
    this.has_stree = static_tree && static_tree.length
  }

  let static_l_desc
  let static_d_desc
  let static_bl_desc

  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree /* the dynamic tree */
    this.max_code = 0 /* largest code with non zero frequency */
    this.stat_desc = stat_desc /* the corresponding static tree */
  }

  const d_code = (dist) => {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)]
  }

  /* ===========================================================================
   * Output a short LSB first on the stream.
   * IN assertion: there is enough room in pendingBuf.
   */
  const put_short = (s, w) => {
    //    put_byte(s, (uch)((w) & 0xff));
    //    put_byte(s, (uch)((ush)(w) >> 8));
    s.pending_buf[s.pending++] = w & 0xff
    s.pending_buf[s.pending++] = (w >>> 8) & 0xff
  }

  /* ===========================================================================
   * Send a value on a given number of bits.
   * IN assertion: length <= 16 and value fits in length bits.
   */
  const send_bits = (s, value, length) => {
    if (s.bi_valid > Buf_size - length) {
      s.bi_buf |= (value << s.bi_valid) & 0xffff
      put_short(s, s.bi_buf)
      s.bi_buf = value >> (Buf_size - s.bi_valid)
      s.bi_valid += length - Buf_size
    } else {
      s.bi_buf |= (value << s.bi_valid) & 0xffff
      s.bi_valid += length
    }
  }

  const send_code = (s, c, tree) => {
    send_bits(s, tree[c * 2] /*.Code*/, tree[c * 2 + 1] /*.Len*/)
  }

  /* ===========================================================================
   * Reverse the first len bits of a code, using straightforward code (a faster
   * method would use a table)
   * IN assertion: 1 <= len <= 15
   */
  const bi_reverse = (code, len) => {
    let res = 0
    do {
      res |= code & 1
      code >>>= 1
      res <<= 1
    } while (--len > 0)
    return res >>> 1
  }

  /* ===========================================================================
   * Flush the bit buffer, keeping at most 7 bits in it.
   */
  const bi_flush = (s) => {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf)
      s.bi_buf = 0
      s.bi_valid = 0
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 0xff
      s.bi_buf >>= 8
      s.bi_valid -= 8
    }
  }

  /* ===========================================================================
   * Compute the optimal bit lengths for a tree and update the total bit length
   * for the current block.
   * IN assertion: the fields freq and dad are set, heap[heap_max] and
   *    above are the tree nodes sorted by increasing frequency.
   * OUT assertions: the field len is set to the optimal bit length, the
   *     array bl_count contains the frequencies for each bit length.
   *     The length opt_len is updated; static_len is also updated if stree is
   *     not null.
   */
  const gen_bitlen = (s, desc) => {
    //    deflate_state *s;
    //    tree_desc *desc;    /* the tree descriptor */

    const tree = desc.dyn_tree
    const max_code = desc.max_code
    const stree = desc.stat_desc.static_tree
    const has_stree = desc.stat_desc.has_stree
    const extra = desc.stat_desc.extra_bits
    const base = desc.stat_desc.extra_base
    const max_length = desc.stat_desc.max_length
    let h /* heap index */
    let n, m /* iterate over the tree elements */
    let bits /* bit length */
    let xbits /* extra bits */
    let f /* frequency */
    let overflow = 0 /* number of elements with bit length too large */

    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0
    }

    /* In a first pass, compute the optimal bit lengths (which may
     * overflow in the case of the bit length tree).
     */
    tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0 /* root of the heap */

    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n = s.heap[h]
      bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1
      if (bits > max_length) {
        bits = max_length
        overflow++
      }
      tree[n * 2 + 1] /*.Len*/ = bits
      /* We overwrite tree[n].Dad which is no longer needed */

      if (n > max_code) {
        continue
      } /* not a leaf node */

      s.bl_count[bits]++
      xbits = 0
      if (n >= base) {
        xbits = extra[n - base]
      }
      f = tree[n * 2] /*.Freq*/
      s.opt_len += f * (bits + xbits)
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits)
      }
    }
    if (overflow === 0) {
      return
    }

    // Tracev((stderr,"\nbit length overflow\n"));
    /* This happens for example on obj2 and pic of the Calgary corpus */

    /* Find the first bit length which could increase: */
    do {
      bits = max_length - 1
      while (s.bl_count[bits] === 0) {
        bits--
      }
      s.bl_count[bits]-- /* move one leaf down the tree */
      s.bl_count[bits + 1] += 2 /* move one overflow item as its brother */
      s.bl_count[max_length]--
      /* The brother of the overflow item also moves one step up,
       * but this does not affect bl_count[max_length]
       */
      overflow -= 2
    } while (overflow > 0)

    /* Now recompute all bit lengths, scanning in increasing frequency.
     * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
     * lengths instead of fixing only the wrong ones. This idea is taken
     * from 'ar' written by Haruhiko Okumura.)
     */
    for (bits = max_length; bits !== 0; bits--) {
      n = s.bl_count[bits]
      while (n !== 0) {
        m = s.heap[--h]
        if (m > max_code) {
          continue
        }
        if (tree[m * 2 + 1] /*.Len*/ !== bits) {
          // Tracev((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
          s.opt_len += (bits - tree[m * 2 + 1]) /*.Len*/ * tree[m * 2] /*.Freq*/
          tree[m * 2 + 1] /*.Len*/ = bits
        }
        n--
      }
    }
  }

  /* ===========================================================================
   * Generate the codes for a given tree and bit counts (which need not be
   * optimal).
   * IN assertion: the array bl_count contains the bit length statistics for
   * the given tree and the field len is set for all tree elements.
   * OUT assertion: the field code is set for all tree elements of non
   *     zero code length.
   */
  const gen_codes = (tree, max_code, bl_count) => {
    //    ct_data *tree;             /* the tree to decorate */
    //    int max_code;              /* largest code with non zero frequency */
    //    ushf *bl_count;            /* number of codes at each bit length */

    const next_code = new Array(
      MAX_BITS$1 + 1
    ) /* next code value for each bit length */
    let code = 0 /* running code value */
    let bits /* bit index */
    let n /* code index */

    /* The distribution counts are first used to generate the code values
     * without bit reversal.
     */
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      code = (code + bl_count[bits - 1]) << 1
      next_code[bits] = code
    }
    /* Check that the bit counts in bl_count are consistent. The last code
     * must be all ones.
     */
    //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
    //        "inconsistent bit counts");
    //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

    for (n = 0; n <= max_code; n++) {
      let len = tree[n * 2 + 1] /*.Len*/
      if (len === 0) {
        continue
      }
      /* Now reverse the bits */
      tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len)

      //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
      //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
    }
  }

  /* ===========================================================================
   * Initialize the various 'constant' tables.
   */
  const tr_static_init = () => {
    let n /* iterates over tree elements */
    let bits /* bit counter */
    let length /* length value */
    let code /* code value */
    let dist /* distance index */
    const bl_count = new Array(MAX_BITS$1 + 1)
    /* number of codes at each bit length for an optimal tree */

    // do check in _tr_init()
    //if (static_init_done) return;

    /* For some embedded targets, global variables are not initialized: */
    /*#ifdef NO_INIT_GLOBAL_POINTERS
    static_l_desc.static_tree = static_ltree;
    static_l_desc.extra_bits = extra_lbits;
    static_d_desc.static_tree = static_dtree;
    static_d_desc.extra_bits = extra_dbits;
    static_bl_desc.extra_bits = extra_blbits;
  #endif*/

    /* Initialize the mapping length (0..255) -> length code (0..28) */
    length = 0
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length
      for (n = 0; n < 1 << extra_lbits[code]; n++) {
        _length_code[length++] = code
      }
    }
    //Assert (length == 256, "tr_static_init: length != 256");
    /* Note that the length 255 (match length 258) can be represented
     * in two different ways: code 284 + 5 bits or code 285, so we
     * overwrite length_code[255] to use the best encoding:
     */
    _length_code[length - 1] = code

    /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
    dist = 0
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist
      for (n = 0; n < 1 << extra_dbits[code]; n++) {
        _dist_code[dist++] = code
      }
    }
    //Assert (dist == 256, "tr_static_init: dist != 256");
    dist >>= 7 /* from now on, all distances are divided by 128 */
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7
      for (n = 0; n < 1 << (extra_dbits[code] - 7); n++) {
        _dist_code[256 + dist++] = code
      }
    }
    //Assert (dist == 256, "tr_static_init: 256+dist != 512");

    /* Construct the codes of the static literal tree */
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0
    }

    n = 0
    while (n <= 143) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8
      n++
      bl_count[8]++
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1] /*.Len*/ = 9
      n++
      bl_count[9]++
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1] /*.Len*/ = 7
      n++
      bl_count[7]++
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8
      n++
      bl_count[8]++
    }
    /* Codes 286 and 287 do not exist, but we must include them in the
     * tree construction to get a canonical Huffman tree (longest code
     * all ones)
     */
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count)

    /* The static distance tree is trivial: */
    for (n = 0; n < D_CODES$1; n++) {
      static_dtree[n * 2 + 1] /*.Len*/ = 5
      static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5)
    }

    // Now data ready and we can init static trees
    static_l_desc = new StaticTreeDesc(
      static_ltree,
      extra_lbits,
      LITERALS$1 + 1,
      L_CODES$1,
      MAX_BITS$1
    )
    static_d_desc = new StaticTreeDesc(
      static_dtree,
      extra_dbits,
      0,
      D_CODES$1,
      MAX_BITS$1
    )
    static_bl_desc = new StaticTreeDesc(
      new Array(0),
      extra_blbits,
      0,
      BL_CODES$1,
      MAX_BL_BITS
    )

    //static_init_done = true;
  }

  /* ===========================================================================
   * Initialize a new block.
   */
  const init_block = (s) => {
    let n /* iterates over tree elements */

    /* Initialize the trees. */
    for (n = 0; n < L_CODES$1; n++) {
      s.dyn_ltree[n * 2] /*.Freq*/ = 0
    }
    for (n = 0; n < D_CODES$1; n++) {
      s.dyn_dtree[n * 2] /*.Freq*/ = 0
    }
    for (n = 0; n < BL_CODES$1; n++) {
      s.bl_tree[n * 2] /*.Freq*/ = 0
    }

    s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1
    s.opt_len = s.static_len = 0
    s.sym_next = s.matches = 0
  }

  /* ===========================================================================
   * Flush the bit buffer and align the output on a byte boundary
   */
  const bi_windup = (s) => {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf)
    } else if (s.bi_valid > 0) {
      //put_byte(s, (Byte)s->bi_buf);
      s.pending_buf[s.pending++] = s.bi_buf
    }
    s.bi_buf = 0
    s.bi_valid = 0
  }

  /* ===========================================================================
   * Compares to subtrees, using the tree depth as tie breaker when
   * the subtrees have equal frequency. This minimizes the worst case length.
   */
  const smaller = (tree, n, m, depth) => {
    const _n2 = n * 2
    const _m2 = m * 2
    return (
      tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ ||
      (tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m])
    )
  }

  /* ===========================================================================
   * Restore the heap property by moving down the tree starting at node k,
   * exchanging a node with the smallest of its two sons if necessary, stopping
   * when the heap property is re-established (each father smaller than its
   * two sons).
   */
  const pqdownheap = (s, tree, k) => {
    //    deflate_state *s;
    //    ct_data *tree;  /* the tree to restore */
    //    int k;               /* node to move down */

    const v = s.heap[k]
    let j = k << 1 /* left son of k */
    while (j <= s.heap_len) {
      /* Set j to the smallest of the two sons: */
      if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++
      }
      /* Exit if v is smaller than both sons */
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break
      }

      /* Exchange v with the smallest son */
      s.heap[k] = s.heap[j]
      k = j

      /* And continue down the tree, setting j to the left son of k */
      j <<= 1
    }
    s.heap[k] = v
  }

  // inlined manually
  // const SMALLEST = 1;

  /* ===========================================================================
   * Send the block data compressed using the given Huffman trees
   */
  const compress_block = (s, ltree, dtree) => {
    //    deflate_state *s;
    //    const ct_data *ltree; /* literal tree */
    //    const ct_data *dtree; /* distance tree */

    let dist /* distance of matched string */
    let lc /* match length or unmatched char (if dist == 0) */
    let sx = 0 /* running index in sym_buf */
    let code /* the code to send */
    let extra /* number of extra bits to send */

    if (s.sym_next !== 0) {
      do {
        dist = s.pending_buf[s.sym_buf + sx++] & 0xff
        dist += (s.pending_buf[s.sym_buf + sx++] & 0xff) << 8
        lc = s.pending_buf[s.sym_buf + sx++]
        if (dist === 0) {
          send_code(s, lc, ltree) /* send a literal byte */
          //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
        } else {
          /* Here, lc is the match length - MIN_MATCH */
          code = _length_code[lc]
          send_code(s, code + LITERALS$1 + 1, ltree) /* send the length code */
          extra = extra_lbits[code]
          if (extra !== 0) {
            lc -= base_length[code]
            send_bits(s, lc, extra) /* send the extra length bits */
          }
          dist-- /* dist is now the match distance - 1 */
          code = d_code(dist)
          //Assert (code < D_CODES, "bad d_code");

          send_code(s, code, dtree) /* send the distance code */
          extra = extra_dbits[code]
          if (extra !== 0) {
            dist -= base_dist[code]
            send_bits(s, dist, extra) /* send the extra distance bits */
          }
        } /* literal or match pair ? */

        /* Check that the overlay between pending_buf and sym_buf is ok: */
        //Assert(s->pending < s->lit_bufsize + sx, "pendingBuf overflow");
      } while (sx < s.sym_next)
    }

    send_code(s, END_BLOCK, ltree)
  }

  /* ===========================================================================
   * Construct one Huffman tree and assigns the code bit strings and lengths.
   * Update the total bit length for the current block.
   * IN assertion: the field freq is set for all tree elements.
   * OUT assertions: the fields len and code are set to the optimal bit length
   *     and corresponding code. The length opt_len is updated; static_len is
   *     also updated if stree is not null. The field max_code is set.
   */
  const build_tree = (s, desc) => {
    //    deflate_state *s;
    //    tree_desc *desc; /* the tree descriptor */

    const tree = desc.dyn_tree
    const stree = desc.stat_desc.static_tree
    const has_stree = desc.stat_desc.has_stree
    const elems = desc.stat_desc.elems
    let n, m /* iterate over heap elements */
    let max_code = -1 /* largest code with non zero frequency */
    let node /* new node being created */

    /* Construct the initial heap, with least frequent element in
     * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
     * heap[0] is not used.
     */
    s.heap_len = 0
    s.heap_max = HEAP_SIZE$1

    for (n = 0; n < elems; n++) {
      if (tree[n * 2] /*.Freq*/ !== 0) {
        s.heap[++s.heap_len] = max_code = n
        s.depth[n] = 0
      } else {
        tree[n * 2 + 1] /*.Len*/ = 0
      }
    }

    /* The pkzip format requires that at least one distance code exists,
     * and that at least one bit should be sent even if there is only one
     * possible code. So to avoid special checks later on we force at least
     * two codes of non zero frequency.
     */
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0
      tree[node * 2] /*.Freq*/ = 1
      s.depth[node] = 0
      s.opt_len--

      if (has_stree) {
        s.static_len -= stree[node * 2 + 1] /*.Len*/
      }
      /* node is 0 or 1 so it does not have extra bits */
    }
    desc.max_code = max_code

    /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
     * establish sub-heaps of increasing lengths:
     */
    for (n = s.heap_len >> 1 /*int /2*/; n >= 1; n--) {
      pqdownheap(s, tree, n)
    }

    /* Construct the Huffman tree by repeatedly combining the least two
     * frequent nodes.
     */
    node = elems /* next internal node of the tree */
    do {
      //pqremove(s, tree, n);  /* n = node of least frequency */
      /*** pqremove ***/
      n = s.heap[1 /*SMALLEST*/]
      s.heap[1 /*SMALLEST*/] = s.heap[s.heap_len--]
      pqdownheap(s, tree, 1 /*SMALLEST*/)
      /***/

      m = s.heap[1 /*SMALLEST*/] /* m = node of next least frequency */

      s.heap[--s.heap_max] = n /* keep the nodes sorted by frequency */
      s.heap[--s.heap_max] = m

      /* Create a new node father of n and m */
      tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1
      tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node

      /* and insert the new node in the heap */
      s.heap[1 /*SMALLEST*/] = node++
      pqdownheap(s, tree, 1 /*SMALLEST*/)
    } while (s.heap_len >= 2)

    s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/]

    /* At this point, the fields freq and dad are set. We can now
     * generate the bit lengths.
     */
    gen_bitlen(s, desc)

    /* The field len is now set, we can generate the bit codes */
    gen_codes(tree, max_code, s.bl_count)
  }

  /* ===========================================================================
   * Scan a literal or distance tree to determine the frequencies of the codes
   * in the bit length tree.
   */
  const scan_tree = (s, tree, max_code) => {
    //    deflate_state *s;
    //    ct_data *tree;   /* the tree to be scanned */
    //    int max_code;    /* and its largest code of non zero frequency */

    let n /* iterates over all tree elements */
    let prevlen = -1 /* last emitted length */
    let curlen /* length of current code */

    let nextlen = tree[0 * 2 + 1] /*.Len*/ /* length of next code */

    let count = 0 /* repeat count of the current code */
    let max_count = 7 /* max repeat count */
    let min_count = 4 /* min repeat count */

    if (nextlen === 0) {
      max_count = 138
      min_count = 3
    }
    tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff /* guard */

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

      if (++count < max_count && curlen === nextlen) {
        continue
      } else if (count < min_count) {
        s.bl_tree[curlen * 2] /*.Freq*/ += count
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2] /*.Freq*/++
        }
        s.bl_tree[REP_3_6 * 2] /*.Freq*/++
      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2] /*.Freq*/++
      } else {
        s.bl_tree[REPZ_11_138 * 2] /*.Freq*/++
      }

      count = 0
      prevlen = curlen

      if (nextlen === 0) {
        max_count = 138
        min_count = 3
      } else if (curlen === nextlen) {
        max_count = 6
        min_count = 3
      } else {
        max_count = 7
        min_count = 4
      }
    }
  }

  /* ===========================================================================
   * Send a literal or distance tree in compressed form, using the codes in
   * bl_tree.
   */
  const send_tree = (s, tree, max_code) => {
    //    deflate_state *s;
    //    ct_data *tree; /* the tree to be scanned */
    //    int max_code;       /* and its largest code of non zero frequency */

    let n /* iterates over all tree elements */
    let prevlen = -1 /* last emitted length */
    let curlen /* length of current code */

    let nextlen = tree[0 * 2 + 1] /*.Len*/ /* length of next code */

    let count = 0 /* repeat count of the current code */
    let max_count = 7 /* max repeat count */
    let min_count = 4 /* min repeat count */

    /* tree[max_code+1].Len = -1; */ /* guard already set */
    if (nextlen === 0) {
      max_count = 138
      min_count = 3
    }

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/

      if (++count < max_count && curlen === nextlen) {
        continue
      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree)
        } while (--count !== 0)
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree)
          count--
        }
        //Assert(count >= 3 && count <= 6, " 3_6?");
        send_code(s, REP_3_6, s.bl_tree)
        send_bits(s, count - 3, 2)
      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree)
        send_bits(s, count - 3, 3)
      } else {
        send_code(s, REPZ_11_138, s.bl_tree)
        send_bits(s, count - 11, 7)
      }

      count = 0
      prevlen = curlen
      if (nextlen === 0) {
        max_count = 138
        min_count = 3
      } else if (curlen === nextlen) {
        max_count = 6
        min_count = 3
      } else {
        max_count = 7
        min_count = 4
      }
    }
  }

  /* ===========================================================================
   * Construct the Huffman tree for the bit lengths and return the index in
   * bl_order of the last bit length code to send.
   */
  const build_bl_tree = (s) => {
    let max_blindex /* index of last bit length code of non zero freq */

    /* Determine the bit length frequencies for literal and distance trees */
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code)
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code)

    /* Build the bit length tree: */
    build_tree(s, s.bl_desc)
    /* opt_len now includes the length of the tree representations, except
     * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
     */

    /* Determine the number of bit length codes to send. The pkzip format
     * requires that at least 4 bit length codes be sent. (appnote.txt says
     * 3 but the actual value used is 4.)
     */
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
        break
      }
    }
    /* Update opt_len to include the bit length tree and counts */
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4
    //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
    //        s->opt_len, s->static_len));

    return max_blindex
  }

  /* ===========================================================================
   * Send the header for a block using dynamic Huffman trees: the counts, the
   * lengths of the bit length codes, the literal tree and the distance tree.
   * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
   */
  const send_all_trees = (s, lcodes, dcodes, blcodes) => {
    //    deflate_state *s;
    //    int lcodes, dcodes, blcodes; /* number of codes for each tree */

    let rank /* index in bl_order */

    //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
    //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
    //        "too many codes");
    //Tracev((stderr, "\nbl counts: "));
    send_bits(s, lcodes - 257, 5) /* not +255 as stated in appnote.txt */
    send_bits(s, dcodes - 1, 5)
    send_bits(s, blcodes - 4, 4) /* not -3 as stated in appnote.txt */
    for (rank = 0; rank < blcodes; rank++) {
      //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
      send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/, 3)
    }
    //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_ltree, lcodes - 1) /* literal tree */
    //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_dtree, dcodes - 1) /* distance tree */
    //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
  }

  /* ===========================================================================
   * Check if the data type is TEXT or BINARY, using the following algorithm:
   * - TEXT if the two conditions below are satisfied:
   *    a) There are no non-portable control characters belonging to the
   *       "block list" (0..6, 14..25, 28..31).
   *    b) There is at least one printable character belonging to the
   *       "allow list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
   * - BINARY otherwise.
   * - The following partially-portable control characters form a
   *   "gray list" that is ignored in this detection algorithm:
   *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
   * IN assertion: the fields Freq of dyn_ltree are set.
   */
  const detect_data_type = (s) => {
    /* block_mask is the bit mask of block-listed bytes
     * set bits 0..6, 14..25, and 28..31
     * 0xf3ffc07f = binary 11110011111111111100000001111111
     */
    let block_mask = 0xf3ffc07f
    let n

    /* Check for non-textual ("block-listed") bytes. */
    for (n = 0; n <= 31; n++, block_mask >>>= 1) {
      if (block_mask & 1 && s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
        return Z_BINARY
      }
    }

    /* Check for textual ("allow-listed") bytes. */
    if (
      s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 ||
      s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2] /*.Freq*/ !== 0
    ) {
      return Z_TEXT
    }
    for (n = 32; n < LITERALS$1; n++) {
      if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
        return Z_TEXT
      }
    }

    /* There are no "block-listed" or "allow-listed" bytes:
     * this stream either is empty or has tolerated ("gray-listed") bytes only.
     */
    return Z_BINARY
  }

  let static_init_done = false

  /* ===========================================================================
   * Initialize the tree data structures for a new zlib stream.
   */
  const _tr_init$1 = (s) => {
    if (!static_init_done) {
      tr_static_init()
      static_init_done = true
    }

    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc)
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc)
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc)

    s.bi_buf = 0
    s.bi_valid = 0

    /* Initialize the first block of the first file: */
    init_block(s)
  }

  /* ===========================================================================
   * Send a stored block
   */
  const _tr_stored_block$1 = (s, buf, stored_len, last) => {
    //DeflateState *s;
    //charf *buf;       /* input block */
    //ulg stored_len;   /* length of input block */
    //int last;         /* one if this is the last block for a file */

    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3) /* send block type */
    bi_windup(s) /* align on byte boundary */
    put_short(s, stored_len)
    put_short(s, ~stored_len)
    if (stored_len) {
      s.pending_buf.set(s.window.subarray(buf, buf + stored_len), s.pending)
    }
    s.pending += stored_len
  }

  /* ===========================================================================
   * Send one empty static block to give enough lookahead for inflate.
   * This takes 10 bits, of which 7 may remain in the bit buffer.
   */
  const _tr_align$1 = (s) => {
    send_bits(s, STATIC_TREES << 1, 3)
    send_code(s, END_BLOCK, static_ltree)
    bi_flush(s)
  }

  /* ===========================================================================
   * Determine the best encoding for the current block: dynamic trees, static
   * trees or store, and write out the encoded block.
   */
  const _tr_flush_block$1 = (s, buf, stored_len, last) => {
    //DeflateState *s;
    //charf *buf;       /* input block, or NULL if too old */
    //ulg stored_len;   /* length of input block */
    //int last;         /* one if this is the last block for a file */

    let opt_lenb, static_lenb /* opt_len and static_len in bytes */
    let max_blindex = 0 /* index of last bit length code of non zero freq */

    /* Build the Huffman trees unless a stored block is forced */
    if (s.level > 0) {
      /* Check if the file is binary or text */
      if (s.strm.data_type === Z_UNKNOWN$1) {
        s.strm.data_type = detect_data_type(s)
      }

      /* Construct the literal and distance trees */
      build_tree(s, s.l_desc)
      // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));

      build_tree(s, s.d_desc)
      // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));
      /* At this point, opt_len and static_len are the total bit lengths of
       * the compressed block data, excluding the tree representations.
       */

      /* Build the bit length tree for the above two trees, and get the index
       * in bl_order of the last bit length code to send.
       */
      max_blindex = build_bl_tree(s)

      /* Determine the best encoding. Compute the block lengths in bytes. */
      opt_lenb = (s.opt_len + 3 + 7) >>> 3
      static_lenb = (s.static_len + 3 + 7) >>> 3

      // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
      //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
      //        s->sym_next / 3));

      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb
      }
    } else {
      // Assert(buf != (char*)0, "lost buf");
      opt_lenb = static_lenb = stored_len + 5 /* force a stored block */
    }

    if (stored_len + 4 <= opt_lenb && buf !== -1) {
      /* 4: two words for the lengths */

      /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
       * Otherwise we can't have processed more than WSIZE input bytes since
       * the last block flush, because compression would have been
       * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
       * transform a block into a stored block.
       */
      _tr_stored_block$1(s, buf, stored_len, last)
    } else if (s.strategy === Z_FIXED$1 || static_lenb === opt_lenb) {
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3)
      compress_block(s, static_ltree, static_dtree)
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3)
      send_all_trees(
        s,
        s.l_desc.max_code + 1,
        s.d_desc.max_code + 1,
        max_blindex + 1
      )
      compress_block(s, s.dyn_ltree, s.dyn_dtree)
    }
    // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
    /* The above check is made mod 2^32, for files larger than 512 MB
     * and uLong implemented on 32 bits.
     */
    init_block(s)

    if (last) {
      bi_windup(s)
    }
    // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
    //       s->compressed_len-7*last));
  }

  /* ===========================================================================
   * Save the match info and tally the frequency counts. Return true if
   * the current block must be flushed.
   */
  const _tr_tally$1 = (s, dist, lc) => {
    //    deflate_state *s;
    //    unsigned dist;  /* distance of matched string */
    //    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */

    s.pending_buf[s.sym_buf + s.sym_next++] = dist
    s.pending_buf[s.sym_buf + s.sym_next++] = dist >> 8
    s.pending_buf[s.sym_buf + s.sym_next++] = lc
    if (dist === 0) {
      /* lc is the unmatched char */
      s.dyn_ltree[lc * 2] /*.Freq*/++
    } else {
      s.matches++
      /* Here, lc is the match length - MIN_MATCH */
      dist-- /* dist = match distance - 1 */
      //Assert((ush)dist < (ush)MAX_DIST(s) &&
      //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
      //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2] /*.Freq*/++
      s.dyn_dtree[d_code(dist) * 2] /*.Freq*/++
    }

    return s.sym_next === s.sym_end
  }

  var _tr_init_1 = _tr_init$1
  var _tr_stored_block_1 = _tr_stored_block$1
  var _tr_flush_block_1 = _tr_flush_block$1
  var _tr_tally_1 = _tr_tally$1
  var _tr_align_1 = _tr_align$1

  var trees = {
    _tr_init: _tr_init_1,
    _tr_stored_block: _tr_stored_block_1,
    _tr_flush_block: _tr_flush_block_1,
    _tr_tally: _tr_tally_1,
    _tr_align: _tr_align_1
  }

  // Note: adler32 takes 12% for level 0 and 2% for level 6.
  // It isn't worth it to make additional optimizations as in original.
  // Small size is preferable.

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  const adler32 = (adler, buf, len, pos) => {
    let s1 = (adler & 0xffff) | 0,
      s2 = ((adler >>> 16) & 0xffff) | 0,
      n = 0

    while (len !== 0) {
      // Set limit ~ twice less than 5552, to keep
      // s2 in 31-bits, because we force signed ints.
      // in other case %= will fail.
      n = len > 2000 ? 2000 : len
      len -= n

      do {
        s1 = (s1 + buf[pos++]) | 0
        s2 = (s2 + s1) | 0
      } while (--n)

      s1 %= 65521
      s2 %= 65521
    }

    return s1 | (s2 << 16) | 0
  }

  var adler32_1 = adler32

  // Note: we can't get significant speed boost here.
  // So write code to minimize size - no pregenerated tables
  // and array tools dependencies.

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  // Use ordinary array, since untyped makes no boost here
  const makeTable = () => {
    let c,
      table = []

    for (var n = 0; n < 256; n++) {
      c = n
      for (var k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[n] = c
    }

    return table
  }

  // Create table on load. Just 255 signed longs. Not a problem.
  const crcTable = new Uint32Array(makeTable())

  const crc32 = (crc, buf, len, pos) => {
    const t = crcTable
    const end = pos + len

    crc ^= -1

    for (let i = pos; i < end; i++) {
      crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xff]
    }

    return crc ^ -1 // >>> 0;
  }

  var crc32_1 = crc32

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  var messages = {
    2: 'need dictionary' /* Z_NEED_DICT       2  */,
    1: 'stream end' /* Z_STREAM_END      1  */,
    0: '' /* Z_OK              0  */,
    '-1': 'file error' /* Z_ERRNO         (-1) */,
    '-2': 'stream error' /* Z_STREAM_ERROR  (-2) */,
    '-3': 'data error' /* Z_DATA_ERROR    (-3) */,
    '-4': 'insufficient memory' /* Z_MEM_ERROR     (-4) */,
    '-5': 'buffer error' /* Z_BUF_ERROR     (-5) */,
    '-6': 'incompatible version' /* Z_VERSION_ERROR (-6) */
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  var constants$2 = {
    /* Allowed flush values; see deflate() and inflate() below for details */
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,

    /* Return codes for the compression/decompression functions. Negative values
     * are errors, positive values are used for special but normal events.
     */
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    //Z_VERSION_ERROR: -6,

    /* compression levels */
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,

    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,

    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY: 0,
    Z_TEXT: 1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN: 2,

    /* The deflate compression method */
    Z_DEFLATED: 8
    //Z_NULL:                 null // Use -1 or null inline, depending on var type
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  const { _tr_init, _tr_stored_block, _tr_flush_block, _tr_tally, _tr_align } =
    trees

  /* Public constants ==========================================================*/
  /* ===========================================================================*/

  const {
    Z_NO_FLUSH: Z_NO_FLUSH$2,
    Z_PARTIAL_FLUSH,
    Z_FULL_FLUSH: Z_FULL_FLUSH$1,
    Z_FINISH: Z_FINISH$3,
    Z_BLOCK: Z_BLOCK$1,
    Z_OK: Z_OK$3,
    Z_STREAM_END: Z_STREAM_END$3,
    Z_STREAM_ERROR: Z_STREAM_ERROR$2,
    Z_DATA_ERROR: Z_DATA_ERROR$2,
    Z_BUF_ERROR: Z_BUF_ERROR$1,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION$1,
    Z_FILTERED,
    Z_HUFFMAN_ONLY,
    Z_RLE,
    Z_FIXED,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY$1,
    Z_UNKNOWN,
    Z_DEFLATED: Z_DEFLATED$2
  } = constants$2

  /*============================================================================*/

  const MAX_MEM_LEVEL = 9
  /* Maximum value for memLevel in deflateInit2 */
  const MAX_WBITS$1 = 15
  /* 32K LZ77 window */
  const DEF_MEM_LEVEL = 8

  const LENGTH_CODES = 29
  /* number of length codes, not counting the special END_BLOCK code */
  const LITERALS = 256
  /* number of literal bytes 0..255 */
  const L_CODES = LITERALS + 1 + LENGTH_CODES
  /* number of Literal or Length codes, including the END_BLOCK code */
  const D_CODES = 30
  /* number of distance codes */
  const BL_CODES = 19
  /* number of codes used to transfer the bit lengths */
  const HEAP_SIZE = 2 * L_CODES + 1
  /* maximum heap size */
  const MAX_BITS = 15
  /* All codes must not exceed MAX_BITS bits */

  const MIN_MATCH = 3
  const MAX_MATCH = 258
  const MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1

  const PRESET_DICT = 0x20

  const INIT_STATE = 42 /* zlib header -> BUSY_STATE */
  //#ifdef GZIP
  const GZIP_STATE = 57 /* gzip header -> BUSY_STATE | EXTRA_STATE */
  //#endif
  const EXTRA_STATE = 69 /* gzip extra block -> NAME_STATE */
  const NAME_STATE = 73 /* gzip file name -> COMMENT_STATE */
  const COMMENT_STATE = 91 /* gzip comment -> HCRC_STATE */
  const HCRC_STATE = 103 /* gzip header CRC -> BUSY_STATE */
  const BUSY_STATE = 113 /* deflate -> FINISH_STATE */
  const FINISH_STATE = 666 /* stream complete */

  const BS_NEED_MORE = 1 /* block not completed, need more input or more output */
  const BS_BLOCK_DONE = 2 /* block flush performed */
  const BS_FINISH_STARTED = 3 /* finish started, need only more output at next deflate */
  const BS_FINISH_DONE = 4 /* finish done, accept no more input or output */

  const OS_CODE = 0x03 // Unix :) . Don't detect, use this default.

  const err = (strm, errorCode) => {
    strm.msg = messages[errorCode]
    return errorCode
  }

  const rank = (f) => {
    return f * 2 - (f > 4 ? 9 : 0)
  }

  const zero = (buf) => {
    let len = buf.length
    while (--len >= 0) {
      buf[len] = 0
    }
  }

  /* ===========================================================================
   * Slide the hash table when sliding the window down (could be avoided with 32
   * bit values at the expense of memory usage). We slide even when level == 0 to
   * keep the hash table consistent if we switch back to level > 0 later.
   */
  const slide_hash = (s) => {
    let n, m
    let p
    let wsize = s.w_size

    n = s.hash_size
    p = n
    do {
      m = s.head[--p]
      s.head[p] = m >= wsize ? m - wsize : 0
    } while (--n)
    n = wsize
    //#ifndef FASTEST
    p = n
    do {
      m = s.prev[--p]
      s.prev[p] = m >= wsize ? m - wsize : 0
      /* If n is not on any hash chain, prev[n] is garbage but
       * its value will never be used.
       */
    } while (--n)
    //#endif
  }

  /* eslint-disable new-cap */
  let HASH_ZLIB = (s, prev, data) =>
    ((prev << s.hash_shift) ^ data) & s.hash_mask
  // This hash causes less collisions, https://github.com/nodeca/pako/issues/135
  // But breaks binary compatibility
  //let HASH_FAST = (s, prev, data) => ((prev << 8) + (prev >> 8) + (data << 4)) & s.hash_mask;
  let HASH = HASH_ZLIB

  /* =========================================================================
   * Flush as much pending output as possible. All deflate() output, except for
   * some deflate_stored() output, goes through this function so some
   * applications may wish to modify it to avoid allocating a large
   * strm->next_out buffer and copying into it. (See also read_buf()).
   */
  const flush_pending = (strm) => {
    const s = strm.state

    //_tr_flush_bits(s);
    let len = s.pending
    if (len > strm.avail_out) {
      len = strm.avail_out
    }
    if (len === 0) {
      return
    }

    strm.output.set(
      s.pending_buf.subarray(s.pending_out, s.pending_out + len),
      strm.next_out
    )
    strm.next_out += len
    s.pending_out += len
    strm.total_out += len
    strm.avail_out -= len
    s.pending -= len
    if (s.pending === 0) {
      s.pending_out = 0
    }
  }

  const flush_block_only = (s, last) => {
    _tr_flush_block(
      s,
      s.block_start >= 0 ? s.block_start : -1,
      s.strstart - s.block_start,
      last
    )
    s.block_start = s.strstart
    flush_pending(s.strm)
  }

  const put_byte = (s, b) => {
    s.pending_buf[s.pending++] = b
  }

  /* =========================================================================
   * Put a short in the pending buffer. The 16-bit value is put in MSB order.
   * IN assertion: the stream state is correct and there is enough room in
   * pending_buf.
   */
  const putShortMSB = (s, b) => {
    //  put_byte(s, (Byte)(b >> 8));
    //  put_byte(s, (Byte)(b & 0xff));
    s.pending_buf[s.pending++] = (b >>> 8) & 0xff
    s.pending_buf[s.pending++] = b & 0xff
  }

  /* ===========================================================================
   * Read a new buffer from the current input stream, update the adler32
   * and total number of bytes read.  All deflate() input goes through
   * this function so some applications may wish to modify it to avoid
   * allocating a large strm->input buffer and copying from it.
   * (See also flush_pending()).
   */
  const read_buf = (strm, buf, start, size) => {
    let len = strm.avail_in

    if (len > size) {
      len = size
    }
    if (len === 0) {
      return 0
    }

    strm.avail_in -= len

    // zmemcpy(buf, strm->next_in, len);
    buf.set(strm.input.subarray(strm.next_in, strm.next_in + len), start)
    if (strm.state.wrap === 1) {
      strm.adler = adler32_1(strm.adler, buf, len, start)
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32_1(strm.adler, buf, len, start)
    }

    strm.next_in += len
    strm.total_in += len

    return len
  }

  /* ===========================================================================
   * Set match_start to the longest match starting at the given string and
   * return its length. Matches shorter or equal to prev_length are discarded,
   * in which case the result is equal to prev_length and match_start is
   * garbage.
   * IN assertions: cur_match is the head of the hash chain for the current
   *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
   * OUT assertion: the match length is not greater than s->lookahead.
   */
  const longest_match = (s, cur_match) => {
    let chain_length = s.max_chain_length /* max hash chain length */
    let scan = s.strstart /* current string */
    let match /* matched string */
    let len /* length of current match */
    let best_len = s.prev_length /* best match length so far */
    let nice_match = s.nice_match /* stop if match long enough */
    const limit =
      s.strstart > s.w_size - MIN_LOOKAHEAD
        ? s.strstart - (s.w_size - MIN_LOOKAHEAD)
        : 0 /*NIL*/

    const _win = s.window // shortcut

    const wmask = s.w_mask
    const prev = s.prev

    /* Stop when cur_match becomes <= limit. To simplify the code,
     * we prevent matches with the string of window index 0.
     */

    const strend = s.strstart + MAX_MATCH
    let scan_end1 = _win[scan + best_len - 1]
    let scan_end = _win[scan + best_len]

    /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
     * It is easy to get rid of this optimization if necessary.
     */
    // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

    /* Do not waste too much time if we already have a good match: */
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2
    }
    /* Do not look for matches beyond the end of the input. This is necessary
     * to make deflate deterministic.
     */
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead
    }

    // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

    do {
      // Assert(cur_match < s->strstart, "no future");
      match = cur_match

      /* Skip to next match if the match length cannot increase
       * or if the match length is less than 2.  Note that the checks below
       * for insufficient lookahead only occur occasionally for performance
       * reasons.  Therefore uninitialized memory will be accessed, and
       * conditional jumps will be made that depend on those values.
       * However the length of the match is limited to the lookahead, so
       * the output of deflate is not affected by the uninitialized values.
       */

      if (
        _win[match + best_len] !== scan_end ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match] !== _win[scan] ||
        _win[++match] !== _win[scan + 1]
      ) {
        continue
      }

      /* The check at best_len-1 can be removed because it will be made
       * again later. (This heuristic is not always a win.)
       * It is not necessary to compare scan[2] and match[2] since they
       * are always equal when the other bytes match, given that
       * the hash keys are equal and that HASH_BITS >= 8.
       */
      scan += 2
      match++
      // Assert(*scan == *match, "match[2]?");

      /* We check for insufficient lookahead only every 8th comparison;
       * the 256th check will be made at strstart+258.
       */
      do {
        /*jshint noempty:false*/
      } while (
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] &&
        scan < strend
      )

      // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

      len = MAX_MATCH - (strend - scan)
      scan = strend - MAX_MATCH

      if (len > best_len) {
        s.match_start = cur_match
        best_len = len
        if (len >= nice_match) {
          break
        }
        scan_end1 = _win[scan + best_len - 1]
        scan_end = _win[scan + best_len]
      }
    } while (
      (cur_match = prev[cur_match & wmask]) > limit &&
      --chain_length !== 0
    )

    if (best_len <= s.lookahead) {
      return best_len
    }
    return s.lookahead
  }

  /* ===========================================================================
   * Fill the window when the lookahead becomes insufficient.
   * Updates strstart and lookahead.
   *
   * IN assertion: lookahead < MIN_LOOKAHEAD
   * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
   *    At least one byte has been read, or avail_in == 0; reads are
   *    performed for at least two bytes (required for the zip translate_eol
   *    option -- not supported here).
   */
  const fill_window = (s) => {
    const _w_size = s.w_size
    let n, more, str

    //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

    do {
      more = s.window_size - s.lookahead - s.strstart

      // JS ints have 32 bit, block below not needed
      /* Deal with !@#$% 64K limit: */
      //if (sizeof(int) <= 2) {
      //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
      //        more = wsize;
      //
      //  } else if (more == (unsigned)(-1)) {
      //        /* Very unlikely, but possible on 16 bit machine if
      //         * strstart == 0 && lookahead == 1 (input done a byte at time)
      //         */
      //        more--;
      //    }
      //}

      /* If the window is almost full and there is insufficient lookahead,
       * move the upper half to the lower one to make room in the upper half.
       */
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
        s.window.set(s.window.subarray(_w_size, _w_size + _w_size - more), 0)
        s.match_start -= _w_size
        s.strstart -= _w_size
        /* we now have strstart >= MAX_DIST */
        s.block_start -= _w_size
        if (s.insert > s.strstart) {
          s.insert = s.strstart
        }
        slide_hash(s)
        more += _w_size
      }
      if (s.strm.avail_in === 0) {
        break
      }

      /* If there was no sliding:
       *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
       *    more == window_size - lookahead - strstart
       * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
       * => more >= window_size - 2*WSIZE + 2
       * In the BIG_MEM or MMAP case (not yet supported),
       *   window_size == input_size + MIN_LOOKAHEAD  &&
       *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
       * Otherwise, window_size == 2*WSIZE so more >= 2.
       * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
       */
      //Assert(more >= 2, "more < 2");
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more)
      s.lookahead += n

      /* Initialize the hash value now that we have some input: */
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert
        s.ins_h = s.window[str]

        /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[str + 1])
        //#if MIN_MATCH != 3
        //        Call update_hash() MIN_MATCH-3 more times
        //#endif
        while (s.insert) {
          /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
          s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1])

          s.prev[str & s.w_mask] = s.head[s.ins_h]
          s.head[s.ins_h] = str
          str++
          s.insert--
          if (s.lookahead + s.insert < MIN_MATCH) {
            break
          }
        }
      }
      /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
       * but this is not important since only literal bytes will be emitted.
       */
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0)

    /* If the WIN_INIT bytes after the end of the current data have never been
     * written, then zero those bytes in order to avoid memory check reports of
     * the use of uninitialized (or uninitialised as Julian writes) bytes by
     * the longest match routines.  Update the high water mark for the next
     * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
     * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
     */
    //  if (s.high_water < s.window_size) {
    //    const curr = s.strstart + s.lookahead;
    //    let init = 0;
    //
    //    if (s.high_water < curr) {
    //      /* Previous high water mark below current data -- zero WIN_INIT
    //       * bytes or up to end of window, whichever is less.
    //       */
    //      init = s.window_size - curr;
    //      if (init > WIN_INIT)
    //        init = WIN_INIT;
    //      zmemzero(s->window + curr, (unsigned)init);
    //      s->high_water = curr + init;
    //    }
    //    else if (s->high_water < (ulg)curr + WIN_INIT) {
    //      /* High water mark at or above current data, but below current data
    //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
    //       * to end of window, whichever is less.
    //       */
    //      init = (ulg)curr + WIN_INIT - s->high_water;
    //      if (init > s->window_size - s->high_water)
    //        init = s->window_size - s->high_water;
    //      zmemzero(s->window + s->high_water, (unsigned)init);
    //      s->high_water += init;
    //    }
    //  }
    //
    //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
    //    "not enough room for search");
  }

  /* ===========================================================================
   * Copy without compression as much as possible from the input stream, return
   * the current block state.
   *
   * In case deflateParams() is used to later switch to a non-zero compression
   * level, s->matches (otherwise unused when storing) keeps track of the number
   * of hash table slides to perform. If s->matches is 1, then one hash table
   * slide will be done when switching. If s->matches is 2, the maximum value
   * allowed here, then the hash table will be cleared, since two or more slides
   * is the same as a clear.
   *
   * deflate_stored() is written to minimize the number of times an input byte is
   * copied. It is most efficient with large input and output buffers, which
   * maximizes the opportunites to have a single copy from next_in to next_out.
   */
  const deflate_stored = (s, flush) => {
    /* Smallest worthy block size when not flushing or finishing. By default
     * this is 32K. This can be as small as 507 bytes for memLevel == 1. For
     * large input and output buffers, the stored block size will be larger.
     */
    let min_block =
      s.pending_buf_size - 5 > s.w_size ? s.w_size : s.pending_buf_size - 5

    /* Copy as many min_block or larger stored blocks directly to next_out as
     * possible. If flushing, copy the remaining available input to next_out as
     * stored blocks, if there is enough space.
     */
    let len,
      left,
      have,
      last = 0
    let used = s.strm.avail_in
    do {
      /* Set len to the maximum size block that we can copy directly with the
       * available input data and output space. Set left to how much of that
       * would be copied from what's left in the window.
       */
      len = 65535 /* MAX_STORED */ /* maximum deflate stored block length */
      have = (s.bi_valid + 42) >> 3 /* number of header bytes */
      if (s.strm.avail_out < have) {
        /* need room for header */
        break
      }
      /* maximum stored block length that will fit in avail_out: */
      have = s.strm.avail_out - have
      left = s.strstart - s.block_start /* bytes left in window */
      if (len > left + s.strm.avail_in) {
        len = left + s.strm.avail_in /* limit len to the input */
      }
      if (len > have) {
        len = have /* limit len to the output */
      }

      /* If the stored block would be less than min_block in length, or if
       * unable to copy all of the available input when flushing, then try
       * copying to the window and the pending buffer instead. Also don't
       * write an empty block when flushing -- deflate() does that.
       */
      if (
        len < min_block &&
        ((len === 0 && flush !== Z_FINISH$3) ||
          flush === Z_NO_FLUSH$2 ||
          len !== left + s.strm.avail_in)
      ) {
        break
      }

      /* Make a dummy stored block in pending to get the header bytes,
       * including any pending bits. This also updates the debugging counts.
       */
      last = flush === Z_FINISH$3 && len === left + s.strm.avail_in ? 1 : 0
      _tr_stored_block(s, 0, 0, last)

      /* Replace the lengths in the dummy stored block with len. */
      s.pending_buf[s.pending - 4] = len
      s.pending_buf[s.pending - 3] = len >> 8
      s.pending_buf[s.pending - 2] = ~len
      s.pending_buf[s.pending - 1] = ~len >> 8

      /* Write the stored block header bytes. */
      flush_pending(s.strm)

      //#ifdef ZLIB_DEBUG
      //    /* Update debugging counts for the data about to be copied. */
      //    s->compressed_len += len << 3;
      //    s->bits_sent += len << 3;
      //#endif

      /* Copy uncompressed bytes from the window to next_out. */
      if (left) {
        if (left > len) {
          left = len
        }
        //zmemcpy(s->strm->next_out, s->window + s->block_start, left);
        s.strm.output.set(
          s.window.subarray(s.block_start, s.block_start + left),
          s.strm.next_out
        )
        s.strm.next_out += left
        s.strm.avail_out -= left
        s.strm.total_out += left
        s.block_start += left
        len -= left
      }

      /* Copy uncompressed bytes directly from next_in to next_out, updating
       * the check value.
       */
      if (len) {
        read_buf(s.strm, s.strm.output, s.strm.next_out, len)
        s.strm.next_out += len
        s.strm.avail_out -= len
        s.strm.total_out += len
      }
    } while (last === 0)

    /* Update the sliding window with the last s->w_size bytes of the copied
     * data, or append all of the copied data to the existing window if less
     * than s->w_size bytes were copied. Also update the number of bytes to
     * insert in the hash tables, in the event that deflateParams() switches to
     * a non-zero compression level.
     */
    used -= s.strm.avail_in /* number of input bytes directly copied */
    if (used) {
      /* If any input was used, then no unused input remains in the window,
       * therefore s->block_start == s->strstart.
       */
      if (used >= s.w_size) {
        /* supplant the previous history */
        s.matches = 2 /* clear hash */
        //zmemcpy(s->window, s->strm->next_in - s->w_size, s->w_size);
        s.window.set(
          s.strm.input.subarray(s.strm.next_in - s.w_size, s.strm.next_in),
          0
        )
        s.strstart = s.w_size
        s.insert = s.strstart
      } else {
        if (s.window_size - s.strstart <= used) {
          /* Slide the window down. */
          s.strstart -= s.w_size
          //zmemcpy(s->window, s->window + s->w_size, s->strstart);
          s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0)
          if (s.matches < 2) {
            s.matches++ /* add a pending slide_hash() */
          }
          if (s.insert > s.strstart) {
            s.insert = s.strstart
          }
        }
        //zmemcpy(s->window + s->strstart, s->strm->next_in - used, used);
        s.window.set(
          s.strm.input.subarray(s.strm.next_in - used, s.strm.next_in),
          s.strstart
        )
        s.strstart += used
        s.insert += used > s.w_size - s.insert ? s.w_size - s.insert : used
      }
      s.block_start = s.strstart
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart
    }

    /* If the last block was written to next_out, then done. */
    if (last) {
      return BS_FINISH_DONE
    }

    /* If flushing and all input has been consumed, then done. */
    if (
      flush !== Z_NO_FLUSH$2 &&
      flush !== Z_FINISH$3 &&
      s.strm.avail_in === 0 &&
      s.strstart === s.block_start
    ) {
      return BS_BLOCK_DONE
    }

    /* Fill the window with any remaining input. */
    have = s.window_size - s.strstart
    if (s.strm.avail_in > have && s.block_start >= s.w_size) {
      /* Slide the window down. */
      s.block_start -= s.w_size
      s.strstart -= s.w_size
      //zmemcpy(s->window, s->window + s->w_size, s->strstart);
      s.window.set(s.window.subarray(s.w_size, s.w_size + s.strstart), 0)
      if (s.matches < 2) {
        s.matches++ /* add a pending slide_hash() */
      }
      have += s.w_size /* more space now */
      if (s.insert > s.strstart) {
        s.insert = s.strstart
      }
    }
    if (have > s.strm.avail_in) {
      have = s.strm.avail_in
    }
    if (have) {
      read_buf(s.strm, s.window, s.strstart, have)
      s.strstart += have
      s.insert += have > s.w_size - s.insert ? s.w_size - s.insert : have
    }
    if (s.high_water < s.strstart) {
      s.high_water = s.strstart
    }

    /* There was not enough avail_out to write a complete worthy or flushed
     * stored block to next_out. Write a stored block to pending instead, if we
     * have enough input for a worthy block, or if flushing and there is enough
     * room for the remaining input as a stored block in the pending buffer.
     */
    have = (s.bi_valid + 42) >> 3 /* number of header bytes */
    /* maximum stored block length that will fit in pending: */
    have =
      s.pending_buf_size - have > 65535 /* MAX_STORED */
        ? 65535 /* MAX_STORED */
        : s.pending_buf_size - have
    min_block = have > s.w_size ? s.w_size : have
    left = s.strstart - s.block_start
    if (
      left >= min_block ||
      ((left || flush === Z_FINISH$3) &&
        flush !== Z_NO_FLUSH$2 &&
        s.strm.avail_in === 0 &&
        left <= have)
    ) {
      len = left > have ? have : left
      last =
        flush === Z_FINISH$3 && s.strm.avail_in === 0 && len === left ? 1 : 0
      _tr_stored_block(s, s.block_start, len, last)
      s.block_start += len
      flush_pending(s.strm)
    }

    /* We've done all we can with the available input and output. */
    return last ? BS_FINISH_STARTED : BS_NEED_MORE
  }

  /* ===========================================================================
   * Compress as much as possible from the input stream, return the current
   * block state.
   * This function does not perform lazy evaluation of matches and inserts
   * new strings in the dictionary only for unmatched strings or for short
   * matches. It is used only for the fast compression options.
   */
  const deflate_fast = (s, flush) => {
    let hash_head /* head of the hash chain */
    let bflush /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s)
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE
        }
        if (s.lookahead === 0) {
          break /* flush the current block */
        }
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
        s.head[s.ins_h] = s.strstart
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       * At this point we have always match_length < MIN_MATCH
       */
      if (
        hash_head !== 0 /*NIL*/ &&
        s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD
      ) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head)
        /* longest_match() sets match_start */
      }
      if (s.match_length >= MIN_MATCH) {
        // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

        /*** _tr_tally_dist(s, s.strstart - s.match_start,
                       s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(
          s,
          s.strstart - s.match_start,
          s.match_length - MIN_MATCH
        )

        s.lookahead -= s.match_length

        /* Insert new strings in the hash table only if the match length
         * is not too large. This saves time but degrades compression.
         */
        if (
          s.match_length <= s.max_lazy_match /*max_insert_length*/ &&
          s.lookahead >= MIN_MATCH
        ) {
          s.match_length-- /* string at strstart already in table */
          do {
            s.strstart++
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
            s.head[s.ins_h] = s.strstart
            /***/
            /* strstart never exceeds WSIZE-MAX_MATCH, so there are
             * always MIN_MATCH bytes ahead.
             */
          } while (--s.match_length !== 0)
          s.strstart++
        } else {
          s.strstart += s.match_length
          s.match_length = 0
          s.ins_h = s.window[s.strstart]
          /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
          s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + 1])

          //#if MIN_MATCH != 3
          //                Call UPDATE_HASH() MIN_MATCH-3 more times
          //#endif
          /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
           * matter since it will be recomputed at next deflate call.
           */
        }
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s.window[s.strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart])

        s.lookahead--
        s.strstart++
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false)
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE
        }
        /***/
      }
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1
    if (flush === Z_FINISH$3) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true)
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED
      }
      /***/
      return BS_FINISH_DONE
    }
    if (s.sym_next) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
    return BS_BLOCK_DONE
  }

  /* ===========================================================================
   * Same as above, but achieves better compression. We use a lazy
   * evaluation for matches: a match is finally adopted only if there is
   * no better match at the next window position.
   */
  const deflate_slow = (s, flush) => {
    let hash_head /* head of hash chain */
    let bflush /* set if current block must be flushed */

    let max_insert

    /* Process the input block. */
    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s)
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE
        }
        if (s.lookahead === 0) {
          break
        } /* flush the current block */
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
        s.head[s.ins_h] = s.strstart
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       */
      s.prev_length = s.match_length
      s.prev_match = s.match_start
      s.match_length = MIN_MATCH - 1

      if (
        hash_head !== 0 /*NIL*/ &&
        s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD /*MAX_DIST(s)*/
      ) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head)
        /* longest_match() sets match_start */

        if (
          s.match_length <= 5 &&
          (s.strategy === Z_FILTERED ||
            (s.match_length === MIN_MATCH &&
              s.strstart - s.match_start > 4096)) /*TOO_FAR*/
        ) {
          /* If prev_match is also MIN_MATCH, match_start is garbage
           * but we will ignore the current match anyway.
           */
          s.match_length = MIN_MATCH - 1
        }
      }
      /* If there was a match at the previous step and the current
       * match is not better, output the previous match:
       */
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH
        /* Do not insert strings in hash table beyond this. */

        //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

        /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                       s.prev_length - MIN_MATCH, bflush);***/
        bflush = _tr_tally(
          s,
          s.strstart - 1 - s.prev_match,
          s.prev_length - MIN_MATCH
        )
        /* Insert in hash table all strings up to the end of the match.
         * strstart-1 and strstart are already inserted. If there is not
         * enough lookahead, the last two strings are not inserted in
         * the hash table.
         */
        s.lookahead -= s.prev_length - 1
        s.prev_length -= 2
        do {
          if (++s.strstart <= max_insert) {
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = HASH(s, s.ins_h, s.window[s.strstart + MIN_MATCH - 1])
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h]
            s.head[s.ins_h] = s.strstart
            /***/
          }
        } while (--s.prev_length !== 0)
        s.match_available = 0
        s.match_length = MIN_MATCH - 1
        s.strstart++

        if (bflush) {
          /*** FLUSH_BLOCK(s, 0); ***/
          flush_block_only(s, false)
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE
          }
          /***/
        }
      } else if (s.match_available) {
        /* If there was no match at the previous position, output a
         * single literal. If there was a match but the current match
         * is longer, truncate the previous match to a single literal.
         */
        //Tracevv((stderr,"%c", s->window[s->strstart-1]));
        /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1])

        if (bflush) {
          /*** FLUSH_BLOCK_ONLY(s, 0) ***/
          flush_block_only(s, false)
          /***/
        }
        s.strstart++
        s.lookahead--
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE
        }
      } else {
        /* There is no previous match to compare with, wait for
         * the next step to decide.
         */
        s.match_available = 1
        s.strstart++
        s.lookahead--
      }
    }
    //Assert (flush != Z_NO_FLUSH, "no flush?");
    if (s.match_available) {
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1])

      s.match_available = 0
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1
    if (flush === Z_FINISH$3) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true)
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED
      }
      /***/
      return BS_FINISH_DONE
    }
    if (s.sym_next) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }

    return BS_BLOCK_DONE
  }

  /* ===========================================================================
   * For Z_RLE, simply look for runs of bytes, generate matches only of distance
   * one.  Do not maintain a hash table.  (It will be regenerated if this run of
   * deflate switches away from Z_RLE.)
   */
  const deflate_rle = (s, flush) => {
    let bflush /* set if current block must be flushed */
    let prev /* byte at distance one to match */
    let scan, strend /* scan goes up to strend for length of run */

    const _win = s.window

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the longest run, plus one for the unrolled loop.
       */
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s)
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$2) {
          return BS_NEED_MORE
        }
        if (s.lookahead === 0) {
          break
        } /* flush the current block */
      }

      /* See how many times the previous byte repeats */
      s.match_length = 0
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1
        prev = _win[scan]
        if (
          prev === _win[++scan] &&
          prev === _win[++scan] &&
          prev === _win[++scan]
        ) {
          strend = s.strstart + MAX_MATCH
          do {
            /*jshint noempty:false*/
          } while (
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            prev === _win[++scan] &&
            scan < strend
          )
          s.match_length = MAX_MATCH - (strend - scan)
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead
          }
        }
        //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
      }

      /* Emit match if have run of MIN_MATCH or longer, else emit literal */
      if (s.match_length >= MIN_MATCH) {
        //check_match(s, s.strstart, s.strstart - 1, s.match_length);

        /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH)

        s.lookahead -= s.match_length
        s.strstart += s.match_length
        s.match_length = 0
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s->window[s->strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart])

        s.lookahead--
        s.strstart++
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false)
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE
        }
        /***/
      }
    }
    s.insert = 0
    if (flush === Z_FINISH$3) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true)
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED
      }
      /***/
      return BS_FINISH_DONE
    }
    if (s.sym_next) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
    return BS_BLOCK_DONE
  }

  /* ===========================================================================
   * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
   * (It will be regenerated if this run of deflate switches away from Huffman.)
   */
  const deflate_huff = (s, flush) => {
    let bflush /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we have a literal to write. */
      if (s.lookahead === 0) {
        fill_window(s)
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH$2) {
            return BS_NEED_MORE
          }
          break /* flush the current block */
        }
      }

      /* Output a literal byte */
      s.match_length = 0
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart])
      s.lookahead--
      s.strstart++
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false)
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE
        }
        /***/
      }
    }
    s.insert = 0
    if (flush === Z_FINISH$3) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true)
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED
      }
      /***/
      return BS_FINISH_DONE
    }
    if (s.sym_next) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false)
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE
      }
      /***/
    }
    return BS_BLOCK_DONE
  }

  /* Values for max_lazy_match, good_match and max_chain_length, depending on
   * the desired pack level (0..9). The values given below have been tuned to
   * exclude worst case performance for pathological files. Better values may be
   * found for specific files.
   */
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length
    this.max_lazy = max_lazy
    this.nice_length = nice_length
    this.max_chain = max_chain
    this.func = func
  }

  const configuration_table = [
    /*      good lazy nice chain */
    new Config(0, 0, 0, 0, deflate_stored) /* 0 store only */,
    new Config(4, 4, 8, 4, deflate_fast) /* 1 max speed, no lazy matches */,
    new Config(4, 5, 16, 8, deflate_fast) /* 2 */,
    new Config(4, 6, 32, 32, deflate_fast) /* 3 */,

    new Config(4, 4, 16, 16, deflate_slow) /* 4 lazy matches */,
    new Config(8, 16, 32, 32, deflate_slow) /* 5 */,
    new Config(8, 16, 128, 128, deflate_slow) /* 6 */,
    new Config(8, 32, 128, 256, deflate_slow) /* 7 */,
    new Config(32, 128, 258, 1024, deflate_slow) /* 8 */,
    new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
  ]

  /* ===========================================================================
   * Initialize the "longest match" routines for a new zlib stream
   */
  const lm_init = (s) => {
    s.window_size = 2 * s.w_size

    /*** CLEAR_HASH(s); ***/
    zero(s.head) // Fill with NIL (= 0);

    /* Set the default configuration parameters:
     */
    s.max_lazy_match = configuration_table[s.level].max_lazy
    s.good_match = configuration_table[s.level].good_length
    s.nice_match = configuration_table[s.level].nice_length
    s.max_chain_length = configuration_table[s.level].max_chain

    s.strstart = 0
    s.block_start = 0
    s.lookahead = 0
    s.insert = 0
    s.match_length = s.prev_length = MIN_MATCH - 1
    s.match_available = 0
    s.ins_h = 0
  }

  function DeflateState() {
    this.strm = null /* pointer back to this zlib stream */
    this.status = 0 /* as the name implies */
    this.pending_buf = null /* output still pending */
    this.pending_buf_size = 0 /* size of pending_buf */
    this.pending_out = 0 /* next pending byte to output to the stream */
    this.pending = 0 /* nb of bytes in the pending buffer */
    this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip */
    this.gzhead = null /* gzip header information to write */
    this.gzindex = 0 /* where in extra, name, or comment */
    this.method = Z_DEFLATED$2 /* can only be DEFLATED */
    this.last_flush = -1 /* value of flush param for previous deflate call */

    this.w_size = 0 /* LZ77 window size (32K by default) */
    this.w_bits = 0 /* log2(w_size)  (8..16) */
    this.w_mask = 0 /* w_size - 1 */

    this.window = null
    /* Sliding window. Input bytes are read into the second half of the window,
     * and move to the first half later to keep a dictionary of at least wSize
     * bytes. With this organization, matches are limited to a distance of
     * wSize-MAX_MATCH bytes, but this ensures that IO is always
     * performed with a length multiple of the block size.
     */

    this.window_size = 0
    /* Actual size of window: 2*wSize, except when the user input buffer
     * is directly used as sliding window.
     */

    this.prev = null
    /* Link to older string with same hash index. To limit the size of this
     * array to 64K, this link is maintained only for the last 32K strings.
     * An index in this array is thus a window index modulo 32K.
     */

    this.head = null /* Heads of the hash chains or NIL. */

    this.ins_h = 0 /* hash index of string to be inserted */
    this.hash_size = 0 /* number of elements in hash table */
    this.hash_bits = 0 /* log2(hash_size) */
    this.hash_mask = 0 /* hash_size-1 */

    this.hash_shift = 0
    /* Number of bits by which ins_h must be shifted at each input
     * step. It must be such that after MIN_MATCH steps, the oldest
     * byte no longer takes part in the hash key, that is:
     *   hash_shift * MIN_MATCH >= hash_bits
     */

    this.block_start = 0
    /* Window position at the beginning of the current output block. Gets
     * negative when the window is moved backwards.
     */

    this.match_length = 0 /* length of best match */
    this.prev_match = 0 /* previous match */
    this.match_available = 0 /* set if previous match exists */
    this.strstart = 0 /* start of string to insert */
    this.match_start = 0 /* start of matching string */
    this.lookahead = 0 /* number of valid bytes ahead in window */

    this.prev_length = 0
    /* Length of the best match at previous step. Matches not greater than this
     * are discarded. This is used in the lazy match evaluation.
     */

    this.max_chain_length = 0
    /* To speed up deflation, hash chains are never searched beyond this
     * length.  A higher limit improves compression ratio but degrades the
     * speed.
     */

    this.max_lazy_match = 0
    /* Attempt to find a better match only when the current match is strictly
     * smaller than this value. This mechanism is used only for compression
     * levels >= 4.
     */
    // That's alias to max_lazy_match, don't use directly
    //this.max_insert_length = 0;
    /* Insert new strings in the hash table only if the match length is not
     * greater than this length. This saves time but degrades compression.
     * max_insert_length is used only for compression levels <= 3.
     */

    this.level = 0 /* compression level (1..9) */
    this.strategy = 0 /* favor or force Huffman coding*/

    this.good_match = 0
    /* Use a faster search when the previous match is longer than this */

    this.nice_match = 0 /* Stop searching when current match exceeds this */

    /* used by trees.c: */

    /* Didn't use ct_data typedef below to suppress compiler warning */

    // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
    // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
    // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

    // Use flat array of DOUBLE size, with interleaved fata,
    // because JS does not support effective
    this.dyn_ltree = new Uint16Array(HEAP_SIZE * 2)
    this.dyn_dtree = new Uint16Array((2 * D_CODES + 1) * 2)
    this.bl_tree = new Uint16Array((2 * BL_CODES + 1) * 2)
    zero(this.dyn_ltree)
    zero(this.dyn_dtree)
    zero(this.bl_tree)

    this.l_desc = null /* desc. for literal tree */
    this.d_desc = null /* desc. for distance tree */
    this.bl_desc = null /* desc. for bit length tree */

    //ush bl_count[MAX_BITS+1];
    this.bl_count = new Uint16Array(MAX_BITS + 1)
    /* number of codes at each bit length for an optimal tree */

    //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
    this.heap = new Uint16Array(
      2 * L_CODES + 1
    ) /* heap used to build the Huffman trees */
    zero(this.heap)

    this.heap_len = 0 /* number of elements in the heap */
    this.heap_max = 0 /* element of largest frequency */
    /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
     * The same heap array is used to build all trees.
     */

    this.depth = new Uint16Array(2 * L_CODES + 1) //uch depth[2*L_CODES+1];
    zero(this.depth)
    /* Depth of each subtree used as tie breaker for trees of equal frequency
     */

    this.sym_buf = 0 /* buffer for distances and literals/lengths */

    this.lit_bufsize = 0
    /* Size of match buffer for literals/lengths.  There are 4 reasons for
     * limiting lit_bufsize to 64K:
     *   - frequencies can be kept in 16 bit counters
     *   - if compression is not successful for the first block, all input
     *     data is still in the window so we can still emit a stored block even
     *     when input comes from standard input.  (This can also be done for
     *     all blocks if lit_bufsize is not greater than 32K.)
     *   - if compression is not successful for a file smaller than 64K, we can
     *     even emit a stored file instead of a stored block (saving 5 bytes).
     *     This is applicable only for zip (not gzip or zlib).
     *   - creating new Huffman trees less frequently may not provide fast
     *     adaptation to changes in the input data statistics. (Take for
     *     example a binary file with poorly compressible code followed by
     *     a highly compressible string table.) Smaller buffer sizes give
     *     fast adaptation but have of course the overhead of transmitting
     *     trees more frequently.
     *   - I can't count above 4
     */

    this.sym_next = 0 /* running index in sym_buf */
    this.sym_end = 0 /* symbol table full when sym_next reaches this */

    this.opt_len = 0 /* bit length of current block with optimal trees */
    this.static_len = 0 /* bit length of current block with static trees */
    this.matches = 0 /* number of string matches in current block */
    this.insert = 0 /* bytes at end of window left to insert */

    this.bi_buf = 0
    /* Output buffer. bits are inserted starting at the bottom (least
     * significant bits).
     */
    this.bi_valid = 0
    /* Number of valid bits in bi_buf.  All bits above the last valid bit
     * are always zero.
     */

    // Used for window memory init. We safely ignore it for JS. That makes
    // sense only for pointers and memory check tools.
    //this.high_water = 0;
    /* High water mark offset in window for initialized bytes -- bytes above
     * this are set to zero in order to avoid memory check warnings when
     * longest match routines access bytes past the input.  This is then
     * updated to the new high water mark.
     */
  }

  /* =========================================================================
   * Check for a valid deflate stream state. Return 0 if ok, 1 if not.
   */
  const deflateStateCheck = (strm) => {
    if (!strm) {
      return 1
    }
    const s = strm.state
    if (
      !s ||
      s.strm !== strm ||
      (s.status !== INIT_STATE &&
        //#ifdef GZIP
        s.status !== GZIP_STATE &&
        //#endif
        s.status !== EXTRA_STATE &&
        s.status !== NAME_STATE &&
        s.status !== COMMENT_STATE &&
        s.status !== HCRC_STATE &&
        s.status !== BUSY_STATE &&
        s.status !== FINISH_STATE)
    ) {
      return 1
    }
    return 0
  }

  const deflateResetKeep = (strm) => {
    if (deflateStateCheck(strm)) {
      return err(strm, Z_STREAM_ERROR$2)
    }

    strm.total_in = strm.total_out = 0
    strm.data_type = Z_UNKNOWN

    const s = strm.state
    s.pending = 0
    s.pending_out = 0

    if (s.wrap < 0) {
      s.wrap = -s.wrap
      /* was made negative by deflate(..., Z_FINISH); */
    }
    s.status =
      //#ifdef GZIP
      s.wrap === 2
        ? GZIP_STATE
        : //#endif
        s.wrap
        ? INIT_STATE
        : BUSY_STATE
    strm.adler =
      s.wrap === 2
        ? 0 // crc32(0, Z_NULL, 0)
        : 1 // adler32(0, Z_NULL, 0)
    s.last_flush = -2
    _tr_init(s)
    return Z_OK$3
  }

  const deflateReset = (strm) => {
    const ret = deflateResetKeep(strm)
    if (ret === Z_OK$3) {
      lm_init(strm.state)
    }
    return ret
  }

  const deflateSetHeader = (strm, head) => {
    if (deflateStateCheck(strm) || strm.state.wrap !== 2) {
      return Z_STREAM_ERROR$2
    }
    strm.state.gzhead = head
    return Z_OK$3
  }

  const deflateInit2 = (
    strm,
    level,
    method,
    windowBits,
    memLevel,
    strategy
  ) => {
    if (!strm) {
      // === Z_NULL
      return Z_STREAM_ERROR$2
    }
    let wrap = 1

    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6
    }

    if (windowBits < 0) {
      /* suppress zlib wrapper */
      wrap = 0
      windowBits = -windowBits
    } else if (windowBits > 15) {
      wrap = 2 /* write gzip wrapper instead */
      windowBits -= 16
    }

    if (
      memLevel < 1 ||
      memLevel > MAX_MEM_LEVEL ||
      method !== Z_DEFLATED$2 ||
      windowBits < 8 ||
      windowBits > 15 ||
      level < 0 ||
      level > 9 ||
      strategy < 0 ||
      strategy > Z_FIXED ||
      (windowBits === 8 && wrap !== 1)
    ) {
      return err(strm, Z_STREAM_ERROR$2)
    }

    if (windowBits === 8) {
      windowBits = 9
    }
    /* until 256-byte window bug fixed */

    const s = new DeflateState()

    strm.state = s
    s.strm = strm
    s.status = INIT_STATE /* to pass state test in deflateReset() */

    s.wrap = wrap
    s.gzhead = null
    s.w_bits = windowBits
    s.w_size = 1 << s.w_bits
    s.w_mask = s.w_size - 1

    s.hash_bits = memLevel + 7
    s.hash_size = 1 << s.hash_bits
    s.hash_mask = s.hash_size - 1
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH)

    s.window = new Uint8Array(s.w_size * 2)
    s.head = new Uint16Array(s.hash_size)
    s.prev = new Uint16Array(s.w_size)

    // Don't need mem init magic for JS.
    //s.high_water = 0;  /* nothing written to s->window yet */

    s.lit_bufsize = 1 << (memLevel + 6) /* 16K elements by default */

    /* We overlay pending_buf and sym_buf. This works since the average size
     * for length/distance pairs over any compressed block is assured to be 31
     * bits or less.
     *
     * Analysis: The longest fixed codes are a length code of 8 bits plus 5
     * extra bits, for lengths 131 to 257. The longest fixed distance codes are
     * 5 bits plus 13 extra bits, for distances 16385 to 32768. The longest
     * possible fixed-codes length/distance pair is then 31 bits total.
     *
     * sym_buf starts one-fourth of the way into pending_buf. So there are
     * three bytes in sym_buf for every four bytes in pending_buf. Each symbol
     * in sym_buf is three bytes -- two for the distance and one for the
     * literal/length. As each symbol is consumed, the pointer to the next
     * sym_buf value to read moves forward three bytes. From that symbol, up to
     * 31 bits are written to pending_buf. The closest the written pending_buf
     * bits gets to the next sym_buf symbol to read is just before the last
     * code is written. At that time, 31*(n-2) bits have been written, just
     * after 24*(n-2) bits have been consumed from sym_buf. sym_buf starts at
     * 8*n bits into pending_buf. (Note that the symbol buffer fills when n-1
     * symbols are written.) The closest the writing gets to what is unread is
     * then n+14 bits. Here n is lit_bufsize, which is 16384 by default, and
     * can range from 128 to 32768.
     *
     * Therefore, at a minimum, there are 142 bits of space between what is
     * written and what is read in the overlain buffers, so the symbols cannot
     * be overwritten by the compressed data. That space is actually 139 bits,
     * due to the three-bit fixed-code block header.
     *
     * That covers the case where either Z_FIXED is specified, forcing fixed
     * codes, or when the use of fixed codes is chosen, because that choice
     * results in a smaller compressed block than dynamic codes. That latter
     * condition then assures that the above analysis also covers all dynamic
     * blocks. A dynamic-code block will only be chosen to be emitted if it has
     * fewer bits than a fixed-code block would for the same set of symbols.
     * Therefore its average symbol length is assured to be less than 31. So
     * the compressed data for a dynamic block also cannot overwrite the
     * symbols from which it is being constructed.
     */

    s.pending_buf_size = s.lit_bufsize * 4
    s.pending_buf = new Uint8Array(s.pending_buf_size)

    // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
    //s->sym_buf = s->pending_buf + s->lit_bufsize;
    s.sym_buf = s.lit_bufsize

    //s->sym_end = (s->lit_bufsize - 1) * 3;
    s.sym_end = (s.lit_bufsize - 1) * 3
    /* We avoid equality with lit_bufsize*3 because of wraparound at 64K
     * on 16 bit machines and because stored blocks are restricted to
     * 64K-1 bytes.
     */

    s.level = level
    s.strategy = strategy
    s.method = method

    return deflateReset(strm)
  }

  const deflateInit = (strm, level) => {
    return deflateInit2(
      strm,
      level,
      Z_DEFLATED$2,
      MAX_WBITS$1,
      DEF_MEM_LEVEL,
      Z_DEFAULT_STRATEGY$1
    )
  }

  /* ========================================================================= */
  const deflate$2 = (strm, flush) => {
    if (deflateStateCheck(strm) || flush > Z_BLOCK$1 || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2
    }

    const s = strm.state

    if (
      !strm.output ||
      (strm.avail_in !== 0 && !strm.input) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH$3)
    ) {
      return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR$1 : Z_STREAM_ERROR$2)
    }

    const old_flush = s.last_flush
    s.last_flush = flush

    /* Flush as much pending output as possible */
    if (s.pending !== 0) {
      flush_pending(strm)
      if (strm.avail_out === 0) {
        /* Since avail_out is 0, deflate will be called again with
         * more output space, but possibly with both pending and
         * avail_in equal to zero. There won't be anything to do,
         * but this is not an error situation so make sure we
         * return OK instead of BUF_ERROR at next call of deflate:
         */
        s.last_flush = -1
        return Z_OK$3
      }

      /* Make sure there is something to do and avoid duplicate consecutive
       * flushes. For repeated and useless calls with Z_FINISH, we keep
       * returning Z_STREAM_END instead of Z_BUF_ERROR.
       */
    } else if (
      strm.avail_in === 0 &&
      rank(flush) <= rank(old_flush) &&
      flush !== Z_FINISH$3
    ) {
      return err(strm, Z_BUF_ERROR$1)
    }

    /* User must not provide more input after the first FINISH: */
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$1)
    }

    /* Write the header */
    if (s.status === INIT_STATE && s.wrap === 0) {
      s.status = BUSY_STATE
    }
    if (s.status === INIT_STATE) {
      /* zlib header */
      let header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8
      let level_flags = -1

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0
      } else if (s.level < 6) {
        level_flags = 1
      } else if (s.level === 6) {
        level_flags = 2
      } else {
        level_flags = 3
      }
      header |= level_flags << 6
      if (s.strstart !== 0) {
        header |= PRESET_DICT
      }
      header += 31 - (header % 31)

      putShortMSB(s, header)

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16)
        putShortMSB(s, strm.adler & 0xffff)
      }
      strm.adler = 1 // adler32(0L, Z_NULL, 0);
      s.status = BUSY_STATE

      /* Compression must start with an empty pending buffer */
      flush_pending(strm)
      if (s.pending !== 0) {
        s.last_flush = -1
        return Z_OK$3
      }
    }
    //#ifdef GZIP
    if (s.status === GZIP_STATE) {
      /* gzip header */
      strm.adler = 0 //crc32(0L, Z_NULL, 0);
      put_byte(s, 31)
      put_byte(s, 139)
      put_byte(s, 8)
      if (!s.gzhead) {
        // s->gzhead == Z_NULL
        put_byte(s, 0)
        put_byte(s, 0)
        put_byte(s, 0)
        put_byte(s, 0)
        put_byte(s, 0)
        put_byte(
          s,
          s.level === 9
            ? 2
            : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2
            ? 4
            : 0
        )
        put_byte(s, OS_CODE)
        s.status = BUSY_STATE

        /* Compression must start with an empty pending buffer */
        flush_pending(strm)
        if (s.pending !== 0) {
          s.last_flush = -1
          return Z_OK$3
        }
      } else {
        put_byte(
          s,
          (s.gzhead.text ? 1 : 0) +
            (s.gzhead.hcrc ? 2 : 0) +
            (!s.gzhead.extra ? 0 : 4) +
            (!s.gzhead.name ? 0 : 8) +
            (!s.gzhead.comment ? 0 : 16)
        )
        put_byte(s, s.gzhead.time & 0xff)
        put_byte(s, (s.gzhead.time >> 8) & 0xff)
        put_byte(s, (s.gzhead.time >> 16) & 0xff)
        put_byte(s, (s.gzhead.time >> 24) & 0xff)
        put_byte(
          s,
          s.level === 9
            ? 2
            : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2
            ? 4
            : 0
        )
        put_byte(s, s.gzhead.os & 0xff)
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff)
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff)
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending, 0)
        }
        s.gzindex = 0
        s.status = EXTRA_STATE
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra /* != Z_NULL*/) {
        let beg = s.pending /* start of bytes to update crc */
        let left = (s.gzhead.extra.length & 0xffff) - s.gzindex
        while (s.pending + left > s.pending_buf_size) {
          let copy = s.pending_buf_size - s.pending
          // zmemcpy(s.pending_buf + s.pending,
          //    s.gzhead.extra + s.gzindex, copy);
          s.pending_buf.set(
            s.gzhead.extra.subarray(s.gzindex, s.gzindex + copy),
            s.pending
          )
          s.pending = s.pending_buf_size
          //--- HCRC_UPDATE(beg) ---//
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32_1(
              strm.adler,
              s.pending_buf,
              s.pending - beg,
              beg
            )
          }
          //---//
          s.gzindex += copy
          flush_pending(strm)
          if (s.pending !== 0) {
            s.last_flush = -1
            return Z_OK$3
          }
          beg = 0
          left -= copy
        }
        // JS specific: s.gzhead.extra may be TypedArray or Array for backward compatibility
        //              TypedArray.slice and TypedArray.from don't exist in IE10-IE11
        let gzhead_extra = new Uint8Array(s.gzhead.extra)
        // zmemcpy(s->pending_buf + s->pending,
        //     s->gzhead->extra + s->gzindex, left);
        s.pending_buf.set(
          gzhead_extra.subarray(s.gzindex, s.gzindex + left),
          s.pending
        )
        s.pending += left
        //--- HCRC_UPDATE(beg) ---//
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
        }
        //---//
        s.gzindex = 0
      }
      s.status = NAME_STATE
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name /* != Z_NULL*/) {
        let beg = s.pending /* start of bytes to update crc */
        let val
        do {
          if (s.pending === s.pending_buf_size) {
            //--- HCRC_UPDATE(beg) ---//
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(
                strm.adler,
                s.pending_buf,
                s.pending - beg,
                beg
              )
            }
            //---//
            flush_pending(strm)
            if (s.pending !== 0) {
              s.last_flush = -1
              return Z_OK$3
            }
            beg = 0
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff
          } else {
            val = 0
          }
          put_byte(s, val)
        } while (val !== 0)
        //--- HCRC_UPDATE(beg) ---//
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
        }
        //---//
        s.gzindex = 0
      }
      s.status = COMMENT_STATE
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment /* != Z_NULL*/) {
        let beg = s.pending /* start of bytes to update crc */
        let val
        do {
          if (s.pending === s.pending_buf_size) {
            //--- HCRC_UPDATE(beg) ---//
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32_1(
                strm.adler,
                s.pending_buf,
                s.pending - beg,
                beg
              )
            }
            //---//
            flush_pending(strm)
            if (s.pending !== 0) {
              s.last_flush = -1
              return Z_OK$3
            }
            beg = 0
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff
          } else {
            val = 0
          }
          put_byte(s, val)
        } while (val !== 0)
        //--- HCRC_UPDATE(beg) ---//
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32_1(strm.adler, s.pending_buf, s.pending - beg, beg)
        }
        //---//
      }
      s.status = HCRC_STATE
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm)
          if (s.pending !== 0) {
            s.last_flush = -1
            return Z_OK$3
          }
        }
        put_byte(s, strm.adler & 0xff)
        put_byte(s, (strm.adler >> 8) & 0xff)
        strm.adler = 0 //crc32(0L, Z_NULL, 0);
      }
      s.status = BUSY_STATE

      /* Compression must start with an empty pending buffer */
      flush_pending(strm)
      if (s.pending !== 0) {
        s.last_flush = -1
        return Z_OK$3
      }
    }
    //#endif

    /* Start a new block or continue the current one.
     */
    if (
      strm.avail_in !== 0 ||
      s.lookahead !== 0 ||
      (flush !== Z_NO_FLUSH$2 && s.status !== FINISH_STATE)
    ) {
      let bstate =
        s.level === 0
          ? deflate_stored(s, flush)
          : s.strategy === Z_HUFFMAN_ONLY
          ? deflate_huff(s, flush)
          : s.strategy === Z_RLE
          ? deflate_rle(s, flush)
          : configuration_table[s.level].func(s, flush)

      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1
          /* avoid BUF_ERROR next call, see above */
        }
        return Z_OK$3
        /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
         * of deflate should use the same flush parameter to make sure
         * that the flush is complete. So we don't have to output an
         * empty block here, this will be done at next call. This also
         * ensures that for a very small output buffer, we emit at most
         * one empty block.
         */
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH) {
          _tr_align(s)
        } else if (flush !== Z_BLOCK$1) {
          /* FULL_FLUSH or SYNC_FLUSH */

          _tr_stored_block(s, 0, 0, false)
          /* For a full flush, this empty block will be recognized
           * as a special marker by inflate_sync().
           */
          if (flush === Z_FULL_FLUSH$1) {
            /*** CLEAR_HASH(s); ***/ /* forget history */
            zero(s.head) // Fill with NIL (= 0);

            if (s.lookahead === 0) {
              s.strstart = 0
              s.block_start = 0
              s.insert = 0
            }
          }
        }
        flush_pending(strm)
        if (strm.avail_out === 0) {
          s.last_flush = -1 /* avoid BUF_ERROR at next call, see above */
          return Z_OK$3
        }
      }
    }

    if (flush !== Z_FINISH$3) {
      return Z_OK$3
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$3
    }

    /* Write the trailer */
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 0xff)
      put_byte(s, (strm.adler >> 8) & 0xff)
      put_byte(s, (strm.adler >> 16) & 0xff)
      put_byte(s, (strm.adler >> 24) & 0xff)
      put_byte(s, strm.total_in & 0xff)
      put_byte(s, (strm.total_in >> 8) & 0xff)
      put_byte(s, (strm.total_in >> 16) & 0xff)
      put_byte(s, (strm.total_in >> 24) & 0xff)
    } else {
      putShortMSB(s, strm.adler >>> 16)
      putShortMSB(s, strm.adler & 0xffff)
    }

    flush_pending(strm)
    /* If avail_out is zero, the application will call deflate again
     * to flush the rest.
     */
    if (s.wrap > 0) {
      s.wrap = -s.wrap
    }
    /* write the trailer only once! */
    return s.pending !== 0 ? Z_OK$3 : Z_STREAM_END$3
  }

  const deflateEnd = (strm) => {
    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2
    }

    const status = strm.state.status

    strm.state = null

    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$3
  }

  /* =========================================================================
   * Initializes the compression dictionary from the given byte
   * sequence without producing any compressed output.
   */
  const deflateSetDictionary = (strm, dictionary) => {
    let dictLength = dictionary.length

    if (deflateStateCheck(strm)) {
      return Z_STREAM_ERROR$2
    }

    const s = strm.state
    const wrap = s.wrap

    if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
      return Z_STREAM_ERROR$2
    }

    /* when using zlib wrappers, compute Adler-32 for provided dictionary */
    if (wrap === 1) {
      /* adler32(strm->adler, dictionary, dictLength); */
      strm.adler = adler32_1(strm.adler, dictionary, dictLength, 0)
    }

    s.wrap = 0 /* avoid computing Adler-32 in read_buf */

    /* if dictionary would fill window, just replace the history */
    if (dictLength >= s.w_size) {
      if (wrap === 0) {
        /* already empty otherwise */
        /*** CLEAR_HASH(s); ***/
        zero(s.head) // Fill with NIL (= 0);
        s.strstart = 0
        s.block_start = 0
        s.insert = 0
      }
      /* use the tail */
      // dictionary = dictionary.slice(dictLength - s.w_size);
      let tmpDict = new Uint8Array(s.w_size)
      tmpDict.set(dictionary.subarray(dictLength - s.w_size, dictLength), 0)
      dictionary = tmpDict
      dictLength = s.w_size
    }
    /* insert dictionary into window and hash */
    const avail = strm.avail_in
    const next = strm.next_in
    const input = strm.input
    strm.avail_in = dictLength
    strm.next_in = 0
    strm.input = dictionary
    fill_window(s)
    while (s.lookahead >= MIN_MATCH) {
      let str = s.strstart
      let n = s.lookahead - (MIN_MATCH - 1)
      do {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = HASH(s, s.ins_h, s.window[str + MIN_MATCH - 1])

        s.prev[str & s.w_mask] = s.head[s.ins_h]

        s.head[s.ins_h] = str
        str++
      } while (--n)
      s.strstart = str
      s.lookahead = MIN_MATCH - 1
      fill_window(s)
    }
    s.strstart += s.lookahead
    s.block_start = s.strstart
    s.insert = s.lookahead
    s.lookahead = 0
    s.match_length = s.prev_length = MIN_MATCH - 1
    s.match_available = 0
    strm.next_in = next
    strm.input = input
    strm.avail_in = avail
    s.wrap = wrap
    return Z_OK$3
  }

  var deflateInit_1 = deflateInit
  var deflateInit2_1 = deflateInit2
  var deflateReset_1 = deflateReset
  var deflateResetKeep_1 = deflateResetKeep
  var deflateSetHeader_1 = deflateSetHeader
  var deflate_2$1 = deflate$2
  var deflateEnd_1 = deflateEnd
  var deflateSetDictionary_1 = deflateSetDictionary
  var deflateInfo = 'pako deflate (from Nodeca project)'

  /* Not implemented
  module.exports.deflateBound = deflateBound;
  module.exports.deflateCopy = deflateCopy;
  module.exports.deflateGetDictionary = deflateGetDictionary;
  module.exports.deflateParams = deflateParams;
  module.exports.deflatePending = deflatePending;
  module.exports.deflatePrime = deflatePrime;
  module.exports.deflateTune = deflateTune;
  */

  var deflate_1$2 = {
    deflateInit: deflateInit_1,
    deflateInit2: deflateInit2_1,
    deflateReset: deflateReset_1,
    deflateResetKeep: deflateResetKeep_1,
    deflateSetHeader: deflateSetHeader_1,
    deflate: deflate_2$1,
    deflateEnd: deflateEnd_1,
    deflateSetDictionary: deflateSetDictionary_1,
    deflateInfo: deflateInfo
  }

  const _has = (obj, key) => {
    return Object.prototype.hasOwnProperty.call(obj, key)
  }

  var assign = function (obj /*from1, from2, from3, ...*/) {
    const sources = Array.prototype.slice.call(arguments, 1)
    while (sources.length) {
      const source = sources.shift()
      if (!source) {
        continue
      }

      if (typeof source !== 'object') {
        throw new TypeError(source + 'must be non-object')
      }

      for (const p in source) {
        if (_has(source, p)) {
          obj[p] = source[p]
        }
      }
    }

    return obj
  }

  // Join array of chunks to single array.
  var flattenChunks = (chunks) => {
    // calculate data length
    let len = 0

    for (let i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length
    }

    // join chunks
    const result = new Uint8Array(len)

    for (let i = 0, pos = 0, l = chunks.length; i < l; i++) {
      let chunk = chunks[i]
      result.set(chunk, pos)
      pos += chunk.length
    }

    return result
  }

  var common = {
    assign: assign,
    flattenChunks: flattenChunks
  }

  // String encode/decode helpers

  // Quick check if we can use fast array to bin string conversion
  //
  // - apply(Array) can fail on Android 2.2
  // - apply(Uint8Array) can fail on iOS 5.1 Safari
  //
  let STR_APPLY_UIA_OK = true

  try {
    String.fromCharCode.apply(null, new Uint8Array(1))
  } catch (__) {
    STR_APPLY_UIA_OK = false
  }

  // Table with utf8 lengths (calculated by first byte of sequence)
  // Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
  // because max possible codepoint is 0x10ffff
  const _utf8len = new Uint8Array(256)
  for (let q = 0; q < 256; q++) {
    _utf8len[q] =
      q >= 252
        ? 6
        : q >= 248
        ? 5
        : q >= 240
        ? 4
        : q >= 224
        ? 3
        : q >= 192
        ? 2
        : 1
  }
  _utf8len[254] = _utf8len[254] = 1 // Invalid sequence start

  // convert string to array (typed, when possible)
  var string2buf = (str) => {
    if (typeof TextEncoder === 'function' && TextEncoder.prototype.encode) {
      return new TextEncoder().encode(str)
    }

    let buf,
      c,
      c2,
      m_pos,
      i,
      str_len = str.length,
      buf_len = 0

    // count binary size
    for (m_pos = 0; m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos)
      if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1)
        if ((c2 & 0xfc00) === 0xdc00) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
          m_pos++
        }
      }
      buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
    }

    // allocate buffer
    buf = new Uint8Array(buf_len)

    // convert
    for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos)
      if ((c & 0xfc00) === 0xd800 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1)
        if ((c2 & 0xfc00) === 0xdc00) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00)
          m_pos++
        }
      }
      if (c < 0x80) {
        /* one byte */
        buf[i++] = c
      } else if (c < 0x800) {
        /* two bytes */
        buf[i++] = 0xc0 | (c >>> 6)
        buf[i++] = 0x80 | (c & 0x3f)
      } else if (c < 0x10000) {
        /* three bytes */
        buf[i++] = 0xe0 | (c >>> 12)
        buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
        buf[i++] = 0x80 | (c & 0x3f)
      } else {
        /* four bytes */
        buf[i++] = 0xf0 | (c >>> 18)
        buf[i++] = 0x80 | ((c >>> 12) & 0x3f)
        buf[i++] = 0x80 | ((c >>> 6) & 0x3f)
        buf[i++] = 0x80 | (c & 0x3f)
      }
    }

    return buf
  }

  // Helper
  const buf2binstring = (buf, len) => {
    // On Chrome, the arguments in a function call that are allowed is `65534`.
    // If the length of the buffer is smaller than that, we can use this optimization,
    // otherwise we will take a slower path.
    if (len < 65534) {
      if (buf.subarray && STR_APPLY_UIA_OK) {
        return String.fromCharCode.apply(
          null,
          buf.length === len ? buf : buf.subarray(0, len)
        )
      }
    }

    let result = ''
    for (let i = 0; i < len; i++) {
      result += String.fromCharCode(buf[i])
    }
    return result
  }

  // convert array to string
  var buf2string = (buf, max) => {
    const len = max || buf.length

    if (typeof TextDecoder === 'function' && TextDecoder.prototype.decode) {
      return new TextDecoder().decode(buf.subarray(0, max))
    }

    let i, out

    // Reserve max possible length (2 words per char)
    // NB: by unknown reasons, Array is significantly faster for
    //     String.fromCharCode.apply than Uint16Array.
    const utf16buf = new Array(len * 2)

    for (out = 0, i = 0; i < len; ) {
      let c = buf[i++]
      // quick process ascii
      if (c < 0x80) {
        utf16buf[out++] = c
        continue
      }

      let c_len = _utf8len[c]
      // skip 5 & 6 byte codes
      if (c_len > 4) {
        utf16buf[out++] = 0xfffd
        i += c_len - 1
        continue
      }

      // apply mask on first byte
      c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07
      // join the rest
      while (c_len > 1 && i < len) {
        c = (c << 6) | (buf[i++] & 0x3f)
        c_len--
      }

      // terminated by end of string?
      if (c_len > 1) {
        utf16buf[out++] = 0xfffd
        continue
      }

      if (c < 0x10000) {
        utf16buf[out++] = c
      } else {
        c -= 0x10000
        utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff)
        utf16buf[out++] = 0xdc00 | (c & 0x3ff)
      }
    }

    return buf2binstring(utf16buf, out)
  }

  // Calculate max possible position in utf8 buffer,
  // that will not break sequence. If that's not possible
  // - (very small limits) return max size as is.
  //
  // buf[] - utf8 bytes array
  // max   - length limit (mandatory);
  var utf8border = (buf, max) => {
    max = max || buf.length
    if (max > buf.length) {
      max = buf.length
    }

    // go back from last position, until start of sequence found
    let pos = max - 1
    while (pos >= 0 && (buf[pos] & 0xc0) === 0x80) {
      pos--
    }

    // Very small and broken sequence,
    // return max, because we should return something anyway.
    if (pos < 0) {
      return max
    }

    // If we came to start of buffer - that means buffer is too small,
    // return max too.
    if (pos === 0) {
      return max
    }

    return pos + _utf8len[buf[pos]] > max ? pos : max
  }

  var strings = {
    string2buf: string2buf,
    buf2string: buf2string,
    utf8border: utf8border
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  function ZStream() {
    /* next input byte */
    this.input = null // JS specific, because we have no pointers
    this.next_in = 0
    /* number of bytes available at input */
    this.avail_in = 0
    /* total number of input bytes read so far */
    this.total_in = 0
    /* next output byte should be put there */
    this.output = null // JS specific, because we have no pointers
    this.next_out = 0
    /* remaining free space at output */
    this.avail_out = 0
    /* total number of bytes output so far */
    this.total_out = 0
    /* last error message, NULL if no error */
    this.msg = '' /*Z_NULL*/
    /* not visible by applications */
    this.state = null
    /* best guess about the data type: binary or text */
    this.data_type = 2 /*Z_UNKNOWN*/
    /* adler32 value of the uncompressed data */
    this.adler = 0
  }

  var zstream = ZStream

  const toString$1 = Object.prototype.toString

  /* Public constants ==========================================================*/
  /* ===========================================================================*/

  const {
    Z_NO_FLUSH: Z_NO_FLUSH$1,
    Z_SYNC_FLUSH,
    Z_FULL_FLUSH,
    Z_FINISH: Z_FINISH$2,
    Z_OK: Z_OK$2,
    Z_STREAM_END: Z_STREAM_END$2,
    Z_DEFAULT_COMPRESSION,
    Z_DEFAULT_STRATEGY,
    Z_DEFLATED: Z_DEFLATED$1
  } = constants$2

  /* ===========================================================================*/

  /**
   * class Deflate
   *
   * Generic JS-style wrapper for zlib calls. If you don't need
   * streaming behaviour - use more simple functions: [[deflate]],
   * [[deflateRaw]] and [[gzip]].
   **/

  /* internal
   * Deflate.chunks -> Array
   *
   * Chunks of output data, if [[Deflate#onData]] not overridden.
   **/

  /**
   * Deflate.result -> Uint8Array
   *
   * Compressed result, generated by default [[Deflate#onData]]
   * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
   * (call [[Deflate#push]] with `Z_FINISH` / `true` param).
   **/

  /**
   * Deflate.err -> Number
   *
   * Error code after deflate finished. 0 (Z_OK) on success.
   * You will not need it in real life, because deflate errors
   * are possible only on wrong options or bad `onData` / `onEnd`
   * custom handlers.
   **/

  /**
   * Deflate.msg -> String
   *
   * Error message, if [[Deflate.err]] != 0
   **/

  /**
   * new Deflate(options)
   * - options (Object): zlib deflate options.
   *
   * Creates new deflator instance with specified params. Throws exception
   * on bad params. Supported options:
   *
   * - `level`
   * - `windowBits`
   * - `memLevel`
   * - `strategy`
   * - `dictionary`
   *
   * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
   * for more information on these.
   *
   * Additional options, for internal needs:
   *
   * - `chunkSize` - size of generated data chunks (16K by default)
   * - `raw` (Boolean) - do raw deflate
   * - `gzip` (Boolean) - create gzip wrapper
   * - `header` (Object) - custom header for gzip
   *   - `text` (Boolean) - true if compressed data believed to be text
   *   - `time` (Number) - modification time, unix timestamp
   *   - `os` (Number) - operation system code
   *   - `extra` (Array) - array of bytes with extra data (max 65536)
   *   - `name` (String) - file name (binary string)
   *   - `comment` (String) - comment (binary string)
   *   - `hcrc` (Boolean) - true if header crc should be added
   *
   * ##### Example:
   *
   * ```javascript
   * const pako = require('pako')
   *   , chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
   *   , chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
   *
   * const deflate = new pako.Deflate({ level: 3});
   *
   * deflate.push(chunk1, false);
   * deflate.push(chunk2, true);  // true -> last chunk
   *
   * if (deflate.err) { throw new Error(deflate.err); }
   *
   * console.log(deflate.result);
   * ```
   **/
  function Deflate$1(options) {
    this.options = common.assign(
      {
        level: Z_DEFAULT_COMPRESSION,
        method: Z_DEFLATED$1,
        chunkSize: 16384,
        windowBits: 15,
        memLevel: 8,
        strategy: Z_DEFAULT_STRATEGY
      },
      options || {}
    )

    let opt = this.options

    if (opt.raw && opt.windowBits > 0) {
      opt.windowBits = -opt.windowBits
    } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
      opt.windowBits += 16
    }

    this.err = 0 // error code, if happens (0 = Z_OK)
    this.msg = '' // error message
    this.ended = false // used to avoid multiple onEnd() calls
    this.chunks = [] // chunks of compressed data

    this.strm = new zstream()
    this.strm.avail_out = 0

    let status = deflate_1$2.deflateInit2(
      this.strm,
      opt.level,
      opt.method,
      opt.windowBits,
      opt.memLevel,
      opt.strategy
    )

    if (status !== Z_OK$2) {
      throw new Error(messages[status])
    }

    if (opt.header) {
      deflate_1$2.deflateSetHeader(this.strm, opt.header)
    }

    if (opt.dictionary) {
      let dict
      // Convert data if needed
      if (typeof opt.dictionary === 'string') {
        // If we need to compress text, change encoding to utf8.
        dict = strings.string2buf(opt.dictionary)
      } else if (toString$1.call(opt.dictionary) === '[object ArrayBuffer]') {
        dict = new Uint8Array(opt.dictionary)
      } else {
        dict = opt.dictionary
      }

      status = deflate_1$2.deflateSetDictionary(this.strm, dict)

      if (status !== Z_OK$2) {
        throw new Error(messages[status])
      }

      this._dict_set = true
    }
  }

  /**
   * Deflate#push(data[, flush_mode]) -> Boolean
   * - data (Uint8Array|ArrayBuffer|String): input data. Strings will be
   *   converted to utf8 byte sequence.
   * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
   *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
   *
   * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
   * new compressed chunks. Returns `true` on success. The last data block must
   * have `flush_mode` Z_FINISH (or `true`). That will flush internal pending
   * buffers and call [[Deflate#onEnd]].
   *
   * On fail call [[Deflate#onEnd]] with error code and return false.
   *
   * ##### Example
   *
   * ```javascript
   * push(chunk, false); // push one of data chunks
   * ...
   * push(chunk, true);  // push last chunk
   * ```
   **/
  Deflate$1.prototype.push = function (data, flush_mode) {
    const strm = this.strm
    const chunkSize = this.options.chunkSize
    let status, _flush_mode

    if (this.ended) {
      return false
    }

    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode
    else _flush_mode = flush_mode === true ? Z_FINISH$2 : Z_NO_FLUSH$1

    // Convert data if needed
    if (typeof data === 'string') {
      // If we need to compress text, change encoding to utf8.
      strm.input = strings.string2buf(data)
    } else if (toString$1.call(data) === '[object ArrayBuffer]') {
      strm.input = new Uint8Array(data)
    } else {
      strm.input = data
    }

    strm.next_in = 0
    strm.avail_in = strm.input.length

    for (;;) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize)
        strm.next_out = 0
        strm.avail_out = chunkSize
      }

      // Make sure avail_out > 6 to avoid repeating markers
      if (
        (_flush_mode === Z_SYNC_FLUSH || _flush_mode === Z_FULL_FLUSH) &&
        strm.avail_out <= 6
      ) {
        this.onData(strm.output.subarray(0, strm.next_out))
        strm.avail_out = 0
        continue
      }

      status = deflate_1$2.deflate(strm, _flush_mode)

      // Ended => flush and finish
      if (status === Z_STREAM_END$2) {
        if (strm.next_out > 0) {
          this.onData(strm.output.subarray(0, strm.next_out))
        }
        status = deflate_1$2.deflateEnd(this.strm)
        this.onEnd(status)
        this.ended = true
        return status === Z_OK$2
      }

      // Flush if out buffer full
      if (strm.avail_out === 0) {
        this.onData(strm.output)
        continue
      }

      // Flush if requested and has data
      if (_flush_mode > 0 && strm.next_out > 0) {
        this.onData(strm.output.subarray(0, strm.next_out))
        strm.avail_out = 0
        continue
      }

      if (strm.avail_in === 0) break
    }

    return true
  }

  /**
   * Deflate#onData(chunk) -> Void
   * - chunk (Uint8Array): output data.
   *
   * By default, stores data blocks in `chunks[]` property and glue
   * those in `onEnd`. Override this handler, if you need another behaviour.
   **/
  Deflate$1.prototype.onData = function (chunk) {
    this.chunks.push(chunk)
  }

  /**
   * Deflate#onEnd(status) -> Void
   * - status (Number): deflate status. 0 (Z_OK) on success,
   *   other if not.
   *
   * Called once after you tell deflate that the input stream is
   * complete (Z_FINISH). By default - join collected chunks,
   * free memory and fill `results` / `err` properties.
   **/
  Deflate$1.prototype.onEnd = function (status) {
    // On success - join
    if (status === Z_OK$2) {
      this.result = common.flattenChunks(this.chunks)
    }
    this.chunks = []
    this.err = status
    this.msg = this.strm.msg
  }

  /**
   * deflate(data[, options]) -> Uint8Array
   * - data (Uint8Array|ArrayBuffer|String): input data to compress.
   * - options (Object): zlib deflate options.
   *
   * Compress `data` with deflate algorithm and `options`.
   *
   * Supported options are:
   *
   * - level
   * - windowBits
   * - memLevel
   * - strategy
   * - dictionary
   *
   * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
   * for more information on these.
   *
   * Sugar (options):
   *
   * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
   *   negative windowBits implicitly.
   *
   * ##### Example:
   *
   * ```javascript
   * const pako = require('pako')
   * const data = new Uint8Array([1,2,3,4,5,6,7,8,9]);
   *
   * console.log(pako.deflate(data));
   * ```
   **/
  function deflate$1(input, options) {
    const deflator = new Deflate$1(options)

    deflator.push(input, true)

    // That will never happens, if you don't cheat with options :)
    if (deflator.err) {
      throw deflator.msg || messages[deflator.err]
    }

    return deflator.result
  }

  /**
   * deflateRaw(data[, options]) -> Uint8Array
   * - data (Uint8Array|ArrayBuffer|String): input data to compress.
   * - options (Object): zlib deflate options.
   *
   * The same as [[deflate]], but creates raw data, without wrapper
   * (header and adler32 crc).
   **/
  function deflateRaw$1(input, options) {
    options = options || {}
    options.raw = true
    return deflate$1(input, options)
  }

  /**
   * gzip(data[, options]) -> Uint8Array
   * - data (Uint8Array|ArrayBuffer|String): input data to compress.
   * - options (Object): zlib deflate options.
   *
   * The same as [[deflate]], but create gzip wrapper instead of
   * deflate one.
   **/
  function gzip$1(input, options) {
    options = options || {}
    options.gzip = true
    return deflate$1(input, options)
  }

  var Deflate_1$1 = Deflate$1
  var deflate_2 = deflate$1
  var deflateRaw_1$1 = deflateRaw$1
  var gzip_1$1 = gzip$1
  var constants$1 = constants$2

  var deflate_1$1 = {
    Deflate: Deflate_1$1,
    deflate: deflate_2,
    deflateRaw: deflateRaw_1$1,
    gzip: gzip_1$1,
    constants: constants$1
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  // See state defs from inflate.js
  const BAD$1 = 16209 /* got a data error -- remain here until reset */
  const TYPE$1 = 16191 /* i: waiting for type bits, including last-flag bit */

  /*
     Decode literal, length, and distance codes and write out the resulting
     literal and match bytes until either not enough input or output is
     available, an end-of-block is encountered, or a data error is encountered.
     When large enough input and output buffers are supplied to inflate(), for
     example, a 16K input buffer and a 64K output buffer, more than 95% of the
     inflate execution time is spent in this routine.

     Entry assumptions:

          state.mode === LEN
          strm.avail_in >= 6
          strm.avail_out >= 258
          start >= strm.avail_out
          state.bits < 8

     On return, state.mode is one of:

          LEN -- ran out of enough output space or enough available input
          TYPE -- reached end of block code, inflate() to interpret next block
          BAD -- error in block data

     Notes:

      - The maximum input bits used by a length/distance pair is 15 bits for the
        length code, 5 bits for the length extra, 15 bits for the distance code,
        and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
        Therefore if strm.avail_in >= 6, then there is enough input to avoid
        checking for available input while decoding.

      - The maximum bytes that a single length/distance pair can output is 258
        bytes, which is the maximum length that can be coded.  inflate_fast()
        requires strm.avail_out >= 258 for each loop to avoid checking for
        output space.
   */
  var inffast = function inflate_fast(strm, start) {
    let _in /* local strm.input */
    let last /* have enough input while in < last */
    let _out /* local strm.output */
    let beg /* inflate()'s initial strm.output */
    let end /* while out < end, enough space available */
    //#ifdef INFLATE_STRICT
    let dmax /* maximum distance from zlib header */
    //#endif
    let wsize /* window size or zero if not using window */
    let whave /* valid bytes in the window */
    let wnext /* window write index */
    // Use `s_window` instead `window`, avoid conflict with instrumentation tools
    let s_window /* allocated sliding window, if wsize != 0 */
    let hold /* local strm.hold */
    let bits /* local strm.bits */
    let lcode /* local strm.lencode */
    let dcode /* local strm.distcode */
    let lmask /* mask for first level of length codes */
    let dmask /* mask for first level of distance codes */
    let here /* retrieved table entry */
    let op /* code bits, operation, extra bits, or */
    /*  window position, window bytes to copy */
    let len /* match length, unused bytes */
    let dist /* match distance */
    let from /* where to copy match from */
    let from_source

    let input, output // JS specific, because we have no pointers

    /* copy state to local variables */
    const state = strm.state
    //here = state.here;
    _in = strm.next_in
    input = strm.input
    last = _in + (strm.avail_in - 5)
    _out = strm.next_out
    output = strm.output
    beg = _out - (start - strm.avail_out)
    end = _out + (strm.avail_out - 257)
    //#ifdef INFLATE_STRICT
    dmax = state.dmax
    //#endif
    wsize = state.wsize
    whave = state.whave
    wnext = state.wnext
    s_window = state.window
    hold = state.hold
    bits = state.bits
    lcode = state.lencode
    dcode = state.distcode
    lmask = (1 << state.lenbits) - 1
    dmask = (1 << state.distbits) - 1

    /* decode literals and length/distances until end-of-block or not enough
       input data or output space */

    top: do {
      if (bits < 15) {
        hold += input[_in++] << bits
        bits += 8
        hold += input[_in++] << bits
        bits += 8
      }

      here = lcode[hold & lmask]

      dolen: for (;;) {
        // Goto emulation
        op = here >>> 24 /*here.bits*/
        hold >>>= op
        bits -= op
        op = (here >>> 16) & 0xff /*here.op*/
        if (op === 0) {
          /* literal */
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          output[_out++] = here & 0xffff /*here.val*/
        } else if (op & 16) {
          /* length base */
          len = here & 0xffff /*here.val*/
          op &= 15 /* number of extra bits */
          if (op) {
            if (bits < op) {
              hold += input[_in++] << bits
              bits += 8
            }
            len += hold & ((1 << op) - 1)
            hold >>>= op
            bits -= op
          }
          //Tracevv((stderr, "inflate:         length %u\n", len));
          if (bits < 15) {
            hold += input[_in++] << bits
            bits += 8
            hold += input[_in++] << bits
            bits += 8
          }
          here = dcode[hold & dmask]

          dodist: for (;;) {
            // goto emulation
            op = here >>> 24 /*here.bits*/
            hold >>>= op
            bits -= op
            op = (here >>> 16) & 0xff /*here.op*/

            if (op & 16) {
              /* distance base */
              dist = here & 0xffff /*here.val*/
              op &= 15 /* number of extra bits */
              if (bits < op) {
                hold += input[_in++] << bits
                bits += 8
                if (bits < op) {
                  hold += input[_in++] << bits
                  bits += 8
                }
              }
              dist += hold & ((1 << op) - 1)
              //#ifdef INFLATE_STRICT
              if (dist > dmax) {
                strm.msg = 'invalid distance too far back'
                state.mode = BAD$1
                break top
              }
              //#endif
              hold >>>= op
              bits -= op
              //Tracevv((stderr, "inflate:         distance %u\n", dist));
              op = _out - beg /* max distance in output */
              if (dist > op) {
                /* see if copy from window */
                op = dist - op /* distance back in window */
                if (op > whave) {
                  if (state.sane) {
                    strm.msg = 'invalid distance too far back'
                    state.mode = BAD$1
                    break top
                  }

                  // (!) This block is disabled in zlib defaults,
                  // don't enable it for binary compatibility
                  //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
                  //                if (len <= op - whave) {
                  //                  do {
                  //                    output[_out++] = 0;
                  //                  } while (--len);
                  //                  continue top;
                  //                }
                  //                len -= op - whave;
                  //                do {
                  //                  output[_out++] = 0;
                  //                } while (--op > whave);
                  //                if (op === 0) {
                  //                  from = _out - dist;
                  //                  do {
                  //                    output[_out++] = output[from++];
                  //                  } while (--len);
                  //                  continue top;
                  //                }
                  //#endif
                }
                from = 0 // window index
                from_source = s_window
                if (wnext === 0) {
                  /* very common case */
                  from += wsize - op
                  if (op < len) {
                    /* some from window */
                    len -= op
                    do {
                      output[_out++] = s_window[from++]
                    } while (--op)
                    from = _out - dist /* rest from output */
                    from_source = output
                  }
                } else if (wnext < op) {
                  /* wrap around window */
                  from += wsize + wnext - op
                  op -= wnext
                  if (op < len) {
                    /* some from end of window */
                    len -= op
                    do {
                      output[_out++] = s_window[from++]
                    } while (--op)
                    from = 0
                    if (wnext < len) {
                      /* some from start of window */
                      op = wnext
                      len -= op
                      do {
                        output[_out++] = s_window[from++]
                      } while (--op)
                      from = _out - dist /* rest from output */
                      from_source = output
                    }
                  }
                } else {
                  /* contiguous in window */
                  from += wnext - op
                  if (op < len) {
                    /* some from window */
                    len -= op
                    do {
                      output[_out++] = s_window[from++]
                    } while (--op)
                    from = _out - dist /* rest from output */
                    from_source = output
                  }
                }
                while (len > 2) {
                  output[_out++] = from_source[from++]
                  output[_out++] = from_source[from++]
                  output[_out++] = from_source[from++]
                  len -= 3
                }
                if (len) {
                  output[_out++] = from_source[from++]
                  if (len > 1) {
                    output[_out++] = from_source[from++]
                  }
                }
              } else {
                from = _out - dist /* copy direct from output */
                do {
                  /* minimum length is three */
                  output[_out++] = output[from++]
                  output[_out++] = output[from++]
                  output[_out++] = output[from++]
                  len -= 3
                } while (len > 2)
                if (len) {
                  output[_out++] = output[from++]
                  if (len > 1) {
                    output[_out++] = output[from++]
                  }
                }
              }
            } else if ((op & 64) === 0) {
              /* 2nd level distance code */
              here =
                dcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
              continue dodist
            } else {
              strm.msg = 'invalid distance code'
              state.mode = BAD$1
              break top
            }

            break // need to emulate goto via "continue"
          }
        } else if ((op & 64) === 0) {
          /* 2nd level length code */
          here = lcode[(here & 0xffff) /*here.val*/ + (hold & ((1 << op) - 1))]
          continue dolen
        } else if (op & 32) {
          /* end-of-block */
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.mode = TYPE$1
          break top
        } else {
          strm.msg = 'invalid literal/length code'
          state.mode = BAD$1
          break top
        }

        break // need to emulate goto via "continue"
      }
    } while (_in < last && _out < end)

    /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
    len = bits >> 3
    _in -= len
    bits -= len << 3
    hold &= (1 << bits) - 1

    /* update state and return */
    strm.next_in = _in
    strm.next_out = _out
    strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last)
    strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end)
    state.hold = hold
    state.bits = bits
    return
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  const MAXBITS = 15
  const ENOUGH_LENS$1 = 852
  const ENOUGH_DISTS$1 = 592
  //const ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

  const CODES$1 = 0
  const LENS$1 = 1
  const DISTS$1 = 2

  const lbase = new Uint16Array([
    /* Length codes 257..285 base */ 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17,
    19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0,
    0
  ])

  const lext = new Uint8Array([
    /* Length codes 257..285 extra */ 16, 16, 16, 16, 16, 16, 16, 16, 17, 17,
    17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16,
    72, 78
  ])

  const dbase = new Uint16Array([
    /* Distance codes 0..29 base */ 1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65,
    97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193,
    12289, 16385, 24577, 0, 0
  ])

  const dext = new Uint8Array([
    /* Distance codes 0..29 extra */ 16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20,
    20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29,
    64, 64
  ])

  const inflate_table = (
    type,
    lens,
    lens_index,
    codes,
    table,
    table_index,
    work,
    opts
  ) => {
    const bits = opts.bits
    //here = opts.here; /* table entry for duplication */

    let len = 0 /* a code's length in bits */
    let sym = 0 /* index of code symbols */
    let min = 0,
      max = 0 /* minimum and maximum code lengths */
    let root = 0 /* number of index bits for root table */
    let curr = 0 /* number of index bits for current table */
    let drop = 0 /* code bits to drop for sub-table */
    let left = 0 /* number of prefix codes available */
    let used = 0 /* code entries in table used */
    let huff = 0 /* Huffman code */
    let incr /* for incrementing code, index */
    let fill /* index for replicating entries */
    let low /* low bits for current root entry */
    let mask /* mask for low root bits */
    let next /* next available space in table */
    let base = null /* base value table to use */
    //  let shoextra;    /* extra bits table to use */
    let match /* use base and extra for symbol >= match */
    const count = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];    /* number of codes of each length */
    const offs = new Uint16Array(MAXBITS + 1) //[MAXBITS+1];     /* offsets in table for each length */
    let extra = null

    let here_bits, here_op, here_val

    /*
     Process a set of code lengths to create a canonical Huffman code.  The
     code lengths are lens[0..codes-1].  Each length corresponds to the
     symbols 0..codes-1.  The Huffman code is generated by first sorting the
     symbols by length from short to long, and retaining the symbol order
     for codes with equal lengths.  Then the code starts with all zero bits
     for the first code of the shortest length, and the codes are integer
     increments for the same length, and zeros are appended as the length
     increases.  For the deflate format, these bits are stored backwards
     from their more natural integer increment ordering, and so when the
     decoding tables are built in the large loop below, the integer codes
     are incremented backwards.

     This routine assumes, but does not check, that all of the entries in
     lens[] are in the range 0..MAXBITS.  The caller must assure this.
     1..MAXBITS is interpreted as that code length.  zero means that that
     symbol does not occur in this code.

     The codes are sorted by computing a count of codes for each length,
     creating from that a table of starting indices for each length in the
     sorted table, and then entering the symbols in order in the sorted
     table.  The sorted table is work[], with that space being provided by
     the caller.

     The length counts are used for other purposes as well, i.e. finding
     the minimum and maximum length codes, determining if there are any
     codes at all, checking for a valid set of lengths, and looking ahead
     at length counts to determine sub-table sizes when building the
     decoding tables.
     */

    /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++
    }

    /* bound code lengths, force root to be within code lengths */
    root = bits
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) {
        break
      }
    }
    if (root > max) {
      root = max
    }
    if (max === 0) {
      /* no symbols to code at all */
      //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
      //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
      //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0

      //table.op[opts.table_index] = 64;
      //table.bits[opts.table_index] = 1;
      //table.val[opts.table_index++] = 0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0

      opts.bits = 1
      return 0 /* no symbols, but wait for decoding to report error */
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) {
        break
      }
    }
    if (root < min) {
      root = min
    }

    /* check for an over-subscribed or incomplete set of lengths */
    left = 1
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1
      left -= count[len]
      if (left < 0) {
        return -1
      } /* over-subscribed */
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1 /* incomplete set */
    }

    /* generate offsets into symbol table for each length for sorting */
    offs[1] = 0
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len]
    }

    /* sort symbols by length, by symbol order within each length */
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym
      }
    }

    /*
     Create and fill in decoding tables.  In this loop, the table being
     filled is at next and has curr index bits.  The code being used is huff
     with length len.  That code is converted to an index by dropping drop
     bits off of the bottom.  For codes where len is less than drop + curr,
     those top drop + curr - len bits are incremented through all values to
     fill the table with replicated entries.

     root is the number of index bits for the root table.  When len exceeds
     root, sub-tables are created pointed to by the root entry with an index
     of the low root bits of huff.  This is saved in low to check for when a
     new sub-table should be started.  drop is zero when the root table is
     being filled, and drop is root when sub-tables are being filled.

     When a new sub-table is needed, it is necessary to look ahead in the
     code lengths to determine what size sub-table is needed.  The length
     counts are used for this, and so count[] is decremented as codes are
     entered in the tables.

     used keeps track of how many table entries have been allocated from the
     provided *table space.  It is checked for LENS and DIST tables against
     the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
     the initial root table size constants.  See the comments in inftrees.h
     for more information.

     sym increments through all symbols, and the loop terminates when
     all codes of length max, i.e. all codes, have been processed.  This
     routine permits incomplete codes, so another loop after this one fills
     in the rest of the decoding tables with invalid code markers.
     */

    /* set up for code type */
    // poor man optimization - use if-else instead of switch,
    // to avoid deopts in old v8
    if (type === CODES$1) {
      base = extra = work /* dummy value--not used */
      match = 20
    } else if (type === LENS$1) {
      base = lbase
      extra = lext
      match = 257
    } else {
      /* DISTS */
      base = dbase
      extra = dext
      match = 0
    }

    /* initialize opts for loop */
    huff = 0 /* starting code */
    sym = 0 /* starting code symbol */
    len = min /* starting code length */
    next = table_index /* current table to fill in */
    curr = root /* current table index bits */
    drop = 0 /* current bits to drop from code for index */
    low = -1 /* trigger new sub-table when len > root */
    used = 1 << root /* use root table entries */
    mask = used - 1 /* mask for comparing low */

    /* check available table space */
    if (
      (type === LENS$1 && used > ENOUGH_LENS$1) ||
      (type === DISTS$1 && used > ENOUGH_DISTS$1)
    ) {
      return 1
    }

    /* process all codes and make table entries */
    for (;;) {
      /* create table entry */
      here_bits = len - drop
      if (work[sym] + 1 < match) {
        here_op = 0
        here_val = work[sym]
      } else if (work[sym] >= match) {
        here_op = extra[work[sym] - match]
        here_val = base[work[sym] - match]
      } else {
        here_op = 32 + 64 /* end of block */
        here_val = 0
      }

      /* replicate for those indices with low len bits equal to huff */
      incr = 1 << (len - drop)
      fill = 1 << curr
      min = fill /* save offset to next table */
      do {
        fill -= incr
        table[next + (huff >> drop) + fill] =
          (here_bits << 24) | (here_op << 16) | here_val | 0
      } while (fill !== 0)

      /* backwards increment the len-bit code huff */
      incr = 1 << (len - 1)
      while (huff & incr) {
        incr >>= 1
      }
      if (incr !== 0) {
        huff &= incr - 1
        huff += incr
      } else {
        huff = 0
      }

      /* go to next symbol, update count, len */
      sym++
      if (--count[len] === 0) {
        if (len === max) {
          break
        }
        len = lens[lens_index + work[sym]]
      }

      /* create new sub-table if needed */
      if (len > root && (huff & mask) !== low) {
        /* if first time, transition to sub-tables */
        if (drop === 0) {
          drop = root
        }

        /* increment past last table */
        next += min /* here min is 1 << curr */

        /* determine length of next table */
        curr = len - drop
        left = 1 << curr
        while (curr + drop < max) {
          left -= count[curr + drop]
          if (left <= 0) {
            break
          }
          curr++
          left <<= 1
        }

        /* check for enough space */
        used += 1 << curr
        if (
          (type === LENS$1 && used > ENOUGH_LENS$1) ||
          (type === DISTS$1 && used > ENOUGH_DISTS$1)
        ) {
          return 1
        }

        /* point entry in root table to sub-table */
        low = huff & mask
        /*table.op[low] = curr;
        table.bits[low] = root;
        table.val[low] = next - opts.table_index;*/
        table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0
      }
    }

    /* fill in remaining table entry if code is incomplete (guaranteed to have
     at most one remaining entry, since if the code is incomplete, the
     maximum code length that was allowed to get this far is one bit) */
    if (huff !== 0) {
      //table.op[next + huff] = 64;            /* invalid code marker */
      //table.bits[next + huff] = len - drop;
      //table.val[next + huff] = 0;
      table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0
    }

    /* set return parameters */
    //opts.table_index += used;
    opts.bits = root
    return 0
  }

  var inftrees = inflate_table

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  const CODES = 0
  const LENS = 1
  const DISTS = 2

  /* Public constants ==========================================================*/
  /* ===========================================================================*/

  const {
    Z_FINISH: Z_FINISH$1,
    Z_BLOCK,
    Z_TREES,
    Z_OK: Z_OK$1,
    Z_STREAM_END: Z_STREAM_END$1,
    Z_NEED_DICT: Z_NEED_DICT$1,
    Z_STREAM_ERROR: Z_STREAM_ERROR$1,
    Z_DATA_ERROR: Z_DATA_ERROR$1,
    Z_MEM_ERROR: Z_MEM_ERROR$1,
    Z_BUF_ERROR,
    Z_DEFLATED
  } = constants$2

  /* STATES ====================================================================*/
  /* ===========================================================================*/

  const HEAD = 16180 /* i: waiting for magic header */
  const FLAGS = 16181 /* i: waiting for method and flags (gzip) */
  const TIME = 16182 /* i: waiting for modification time (gzip) */
  const OS = 16183 /* i: waiting for extra flags and operating system (gzip) */
  const EXLEN = 16184 /* i: waiting for extra length (gzip) */
  const EXTRA = 16185 /* i: waiting for extra bytes (gzip) */
  const NAME = 16186 /* i: waiting for end of file name (gzip) */
  const COMMENT = 16187 /* i: waiting for end of comment (gzip) */
  const HCRC = 16188 /* i: waiting for header crc (gzip) */
  const DICTID = 16189 /* i: waiting for dictionary check value */
  const DICT = 16190 /* waiting for inflateSetDictionary() call */
  const TYPE = 16191 /* i: waiting for type bits, including last-flag bit */
  const TYPEDO = 16192 /* i: same, but skip check to exit inflate on new block */
  const STORED = 16193 /* i: waiting for stored size (length and complement) */
  const COPY_ = 16194 /* i/o: same as COPY below, but only first time in */
  const COPY = 16195 /* i/o: waiting for input or output to copy stored block */
  const TABLE = 16196 /* i: waiting for dynamic block table lengths */
  const LENLENS = 16197 /* i: waiting for code length code lengths */
  const CODELENS = 16198 /* i: waiting for length/lit and distance code lengths */
  const LEN_ = 16199 /* i: same as LEN below, but only first time in */
  const LEN = 16200 /* i: waiting for length/lit/eob code */
  const LENEXT = 16201 /* i: waiting for length extra bits */
  const DIST = 16202 /* i: waiting for distance code */
  const DISTEXT = 16203 /* i: waiting for distance extra bits */
  const MATCH = 16204 /* o: waiting for output space to copy string */
  const LIT = 16205 /* o: waiting for output space to write literal */
  const CHECK = 16206 /* i: waiting for 32-bit check value */
  const LENGTH = 16207 /* i: waiting for 32-bit length (gzip) */
  const DONE = 16208 /* finished check, done -- remain here until reset */
  const BAD = 16209 /* got a data error -- remain here until reset */
  const MEM = 16210 /* got an inflate() memory error -- remain here until reset */
  const SYNC = 16211 /* looking for synchronization bytes to restart inflate() */

  /* ===========================================================================*/

  const ENOUGH_LENS = 852
  const ENOUGH_DISTS = 592
  //const ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

  const MAX_WBITS = 15
  /* 32K LZ77 window */
  const DEF_WBITS = MAX_WBITS

  const zswap32 = (q) => {
    return (
      ((q >>> 24) & 0xff) +
      ((q >>> 8) & 0xff00) +
      ((q & 0xff00) << 8) +
      ((q & 0xff) << 24)
    )
  }

  function InflateState() {
    this.strm = null /* pointer back to this zlib stream */
    this.mode = 0 /* current inflate mode */
    this.last = false /* true if processing last block */
    this.wrap = 0 /* bit 0 true for zlib, bit 1 true for gzip,
                                   bit 2 true to validate check value */
    this.havedict = false /* true if dictionary provided */
    this.flags = 0 /* gzip header method and flags (0 if zlib), or
                                   -1 if raw or no header yet */
    this.dmax = 0 /* zlib header max distance (INFLATE_STRICT) */
    this.check = 0 /* protected copy of check value */
    this.total = 0 /* protected copy of output count */
    // TODO: may be {}
    this.head = null /* where to save gzip header information */

    /* sliding window */
    this.wbits = 0 /* log base 2 of requested window size */
    this.wsize = 0 /* window size or zero if not using window */
    this.whave = 0 /* valid bytes in the window */
    this.wnext = 0 /* window write index */
    this.window = null /* allocated sliding window, if needed */

    /* bit accumulator */
    this.hold = 0 /* input bit accumulator */
    this.bits = 0 /* number of bits in "in" */

    /* for string and stored block copying */
    this.length = 0 /* literal or length of data to copy */
    this.offset = 0 /* distance back to copy string from */

    /* for table and code decoding */
    this.extra = 0 /* extra bits needed */

    /* fixed and dynamic code tables */
    this.lencode = null /* starting table for length/literal codes */
    this.distcode = null /* starting table for distance codes */
    this.lenbits = 0 /* index bits for lencode */
    this.distbits = 0 /* index bits for distcode */

    /* dynamic table building */
    this.ncode = 0 /* number of code length code lengths */
    this.nlen = 0 /* number of length code lengths */
    this.ndist = 0 /* number of distance code lengths */
    this.have = 0 /* number of code lengths in lens[] */
    this.next = null /* next available space in codes[] */

    this.lens = new Uint16Array(320) /* temporary storage for code lengths */
    this.work = new Uint16Array(288) /* work area for code table building */

    /*
     because we don't have pointers in js, we use lencode and distcode directly
     as buffers so we don't need codes
    */
    //this.codes = new Int32Array(ENOUGH);       /* space for code tables */
    this.lendyn =
      null /* dynamic table for length/literal codes (JS specific) */
    this.distdyn = null /* dynamic table for distance codes (JS specific) */
    this.sane = 0 /* if false, allow invalid distance too far */
    this.back = 0 /* bits back of last unprocessed length/lit */
    this.was = 0 /* initial length of match */
  }

  const inflateStateCheck = (strm) => {
    if (!strm) {
      return 1
    }
    const state = strm.state
    if (
      !state ||
      state.strm !== strm ||
      state.mode < HEAD ||
      state.mode > SYNC
    ) {
      return 1
    }
    return 0
  }

  const inflateResetKeep = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }
    const state = strm.state
    strm.total_in = strm.total_out = state.total = 0
    strm.msg = '' /*Z_NULL*/
    if (state.wrap) {
      /* to support ill-conceived Java test suite */
      strm.adler = state.wrap & 1
    }
    state.mode = HEAD
    state.last = 0
    state.havedict = 0
    state.flags = -1
    state.dmax = 32768
    state.head = null /*Z_NULL*/
    state.hold = 0
    state.bits = 0
    //state.lencode = state.distcode = state.next = state.codes;
    state.lencode = state.lendyn = new Int32Array(ENOUGH_LENS)
    state.distcode = state.distdyn = new Int32Array(ENOUGH_DISTS)

    state.sane = 1
    state.back = -1
    //Tracev((stderr, "inflate: reset\n"));
    return Z_OK$1
  }

  const inflateReset = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }
    const state = strm.state
    state.wsize = 0
    state.whave = 0
    state.wnext = 0
    return inflateResetKeep(strm)
  }

  const inflateReset2 = (strm, windowBits) => {
    let wrap

    /* get the state */
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }
    const state = strm.state

    /* extract wrap request from windowBits parameter */
    if (windowBits < 0) {
      wrap = 0
      windowBits = -windowBits
    } else {
      wrap = (windowBits >> 4) + 5
      if (windowBits < 48) {
        windowBits &= 15
      }
    }

    /* set number of window bits, free window if different */
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null
    }

    /* update state and reset the rest of it */
    state.wrap = wrap
    state.wbits = windowBits
    return inflateReset(strm)
  }

  const inflateInit2 = (strm, windowBits) => {
    if (!strm) {
      return Z_STREAM_ERROR$1
    }
    //strm.msg = Z_NULL;                 /* in case we return an error */

    const state = new InflateState()

    //if (state === Z_NULL) return Z_MEM_ERROR;
    //Tracev((stderr, "inflate: allocated\n"));
    strm.state = state
    state.strm = strm
    state.window = null /*Z_NULL*/
    state.mode = HEAD /* to pass state test in inflateReset2() */
    const ret = inflateReset2(strm, windowBits)
    if (ret !== Z_OK$1) {
      strm.state = null /*Z_NULL*/
    }
    return ret
  }

  const inflateInit = (strm) => {
    return inflateInit2(strm, DEF_WBITS)
  }

  /*
   Return state with length and distance decoding tables and index sizes set to
   fixed code decoding.  Normally this returns fixed tables from inffixed.h.
   If BUILDFIXED is defined, then instead this routine builds the tables the
   first time it's called, and returns those tables the first time and
   thereafter.  This reduces the size of the code by about 2K bytes, in
   exchange for a little execution time.  However, BUILDFIXED should not be
   used for threaded applications, since the rewriting of the tables and virgin
   may not be thread-safe.
   */
  let virgin = true

  let lenfix, distfix // We have no pointers in JS, so keep tables separate

  const fixedtables = (state) => {
    /* build fixed huffman tables if first call (may not be thread safe) */
    if (virgin) {
      lenfix = new Int32Array(512)
      distfix = new Int32Array(32)

      /* literal/length table */
      let sym = 0
      while (sym < 144) {
        state.lens[sym++] = 8
      }
      while (sym < 256) {
        state.lens[sym++] = 9
      }
      while (sym < 280) {
        state.lens[sym++] = 7
      }
      while (sym < 288) {
        state.lens[sym++] = 8
      }

      inftrees(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 })

      /* distance table */
      sym = 0
      while (sym < 32) {
        state.lens[sym++] = 5
      }

      inftrees(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 })

      /* do this just once */
      virgin = false
    }

    state.lencode = lenfix
    state.lenbits = 9
    state.distcode = distfix
    state.distbits = 5
  }

  /*
   Update the window with the last wsize (normally 32K) bytes written before
   returning.  If window does not exist yet, create it.  This is only called
   when a window is already in use, or when output has been written during this
   inflate call, but the end of the deflate stream has not been reached yet.
   It is also called to create a window for dictionary data when a dictionary
   is loaded.

   Providing output buffers larger than 32K to inflate() should provide a speed
   advantage, since only the last 32K of output is copied to the sliding window
   upon return from inflate(), and since all distances after the first 32K of
   output will fall in the output data, making match copies simpler and faster.
   The advantage may be dependent on the size of the processor's data caches.
   */
  const updatewindow = (strm, src, end, copy) => {
    let dist
    const state = strm.state

    /* if it hasn't been done already, allocate space for the window */
    if (state.window === null) {
      state.wsize = 1 << state.wbits
      state.wnext = 0
      state.whave = 0

      state.window = new Uint8Array(state.wsize)
    }

    /* copy state->wsize or less output bytes into the circular window */
    if (copy >= state.wsize) {
      state.window.set(src.subarray(end - state.wsize, end), 0)
      state.wnext = 0
      state.whave = state.wsize
    } else {
      dist = state.wsize - state.wnext
      if (dist > copy) {
        dist = copy
      }
      //zmemcpy(state->window + state->wnext, end - copy, dist);
      state.window.set(src.subarray(end - copy, end - copy + dist), state.wnext)
      copy -= dist
      if (copy) {
        //zmemcpy(state->window, end - copy, copy);
        state.window.set(src.subarray(end - copy, end), 0)
        state.wnext = copy
        state.whave = state.wsize
      } else {
        state.wnext += dist
        if (state.wnext === state.wsize) {
          state.wnext = 0
        }
        if (state.whave < state.wsize) {
          state.whave += dist
        }
      }
    }
    return 0
  }

  const inflate$2 = (strm, flush) => {
    let state
    let input, output // input/output buffers
    let next /* next input INDEX */
    let put /* next output INDEX */
    let have, left /* available input and output */
    let hold /* bit buffer */
    let bits /* bits in bit buffer */
    let _in, _out /* save starting available input and output */
    let copy /* number of stored or match bytes to copy */
    let from /* where to copy match bytes from */
    let from_source
    let here = 0 /* current decoding table entry */
    let here_bits, here_op, here_val // paked "here" denormalized (JS specific)
    //let last;                   /* parent table entry */
    let last_bits, last_op, last_val // paked "last" denormalized (JS specific)
    let len /* length to copy for repeats, bits to drop */
    let ret /* return code */
    const hbuf = new Uint8Array(4) /* buffer for gzip header crc calculation */
    let opts

    let n // temporary variable for NEED_BITS

    const order =
      /* permutation of code lengths */
      new Uint8Array([
        16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15
      ])

    if (
      inflateStateCheck(strm) ||
      !strm.output ||
      (!strm.input && strm.avail_in !== 0)
    ) {
      return Z_STREAM_ERROR$1
    }

    state = strm.state
    if (state.mode === TYPE) {
      state.mode = TYPEDO
    } /* skip check */

    //--- LOAD() ---
    put = strm.next_out
    output = strm.output
    left = strm.avail_out
    next = strm.next_in
    input = strm.input
    have = strm.avail_in
    hold = state.hold
    bits = state.bits
    //---

    _in = have
    _out = left
    ret = Z_OK$1

    // goto emulation
    inf_leave: for (;;) {
      switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO
            break
          }
          //=== NEEDBITS(16);
          while (bits < 16) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if (state.wrap & 2 && hold === 0x8b1f) {
            /* gzip header */
            if (state.wbits === 0) {
              state.wbits = 15
            }
            state.check = 0 /*crc32(0L, Z_NULL, 0)*/
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff
            hbuf[1] = (hold >>> 8) & 0xff
            state.check = crc32_1(state.check, hbuf, 2, 0)
            //===//

            //=== INITBITS();
            hold = 0
            bits = 0
            //===//
            state.mode = FLAGS
            break
          }
          if (state.head) {
            state.head.done = false
          }
          if (
            !(state.wrap & 1) /* check if zlib header allowed */ ||
            (((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31
          ) {
            strm.msg = 'incorrect header check'
            state.mode = BAD
            break
          }
          if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED) {
            strm.msg = 'unknown compression method'
            state.mode = BAD
            break
          }
          //--- DROPBITS(4) ---//
          hold >>>= 4
          bits -= 4
          //---//
          len = (hold & 0x0f) /*BITS(4)*/ + 8
          if (state.wbits === 0) {
            state.wbits = len
          }
          if (len > 15 || len > state.wbits) {
            strm.msg = 'invalid window size'
            state.mode = BAD
            break
          }

          // !!! pako patch. Force use `options.windowBits` if passed.
          // Required to always use max window size by default.
          state.dmax = 1 << state.wbits
          //state.dmax = 1 << len;

          state.flags = 0 /* indicate zlib header */
          //Tracev((stderr, "inflate:   zlib header ok\n"));
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
          state.mode = hold & 0x200 ? DICTID : TYPE
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          break
        case FLAGS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.flags = hold
          if ((state.flags & 0xff) !== Z_DEFLATED) {
            strm.msg = 'unknown compression method'
            state.mode = BAD
            break
          }
          if (state.flags & 0xe000) {
            strm.msg = 'unknown header flags set'
            state.mode = BAD
            break
          }
          if (state.head) {
            state.head.text = (hold >> 8) & 1
          }
          if (state.flags & 0x0200 && state.wrap & 4) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff
            hbuf[1] = (hold >>> 8) & 0xff
            state.check = crc32_1(state.check, hbuf, 2, 0)
            //===//
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = TIME
        /* falls through */
        case TIME:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if (state.head) {
            state.head.time = hold
          }
          if (state.flags & 0x0200 && state.wrap & 4) {
            //=== CRC4(state.check, hold)
            hbuf[0] = hold & 0xff
            hbuf[1] = (hold >>> 8) & 0xff
            hbuf[2] = (hold >>> 16) & 0xff
            hbuf[3] = (hold >>> 24) & 0xff
            state.check = crc32_1(state.check, hbuf, 4, 0)
            //===
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = OS
        /* falls through */
        case OS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if (state.head) {
            state.head.xflags = hold & 0xff
            state.head.os = hold >> 8
          }
          if (state.flags & 0x0200 && state.wrap & 4) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff
            hbuf[1] = (hold >>> 8) & 0xff
            state.check = crc32_1(state.check, hbuf, 2, 0)
            //===//
          }
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = EXLEN
        /* falls through */
        case EXLEN:
          if (state.flags & 0x0400) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            state.length = hold
            if (state.head) {
              state.head.extra_len = hold
            }
            if (state.flags & 0x0200 && state.wrap & 4) {
              //=== CRC2(state.check, hold);
              hbuf[0] = hold & 0xff
              hbuf[1] = (hold >>> 8) & 0xff
              state.check = crc32_1(state.check, hbuf, 2, 0)
              //===//
            }
            //=== INITBITS();
            hold = 0
            bits = 0
            //===//
          } else if (state.head) {
            state.head.extra = null /*Z_NULL*/
          }
          state.mode = EXTRA
        /* falls through */
        case EXTRA:
          if (state.flags & 0x0400) {
            copy = state.length
            if (copy > have) {
              copy = have
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length
                if (!state.head.extra) {
                  // Use untyped array for more convenient processing later
                  state.head.extra = new Uint8Array(state.head.extra_len)
                }
                state.head.extra.set(
                  input.subarray(
                    next,
                    // extra field is limited to 65536 bytes
                    // - no need for additional size check
                    next + copy
                  ),
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                )
                //zmemcpy(state.head.extra + len, next,
                //        len + copy > state.head.extra_max ?
                //        state.head.extra_max - len : copy);
              }
              if (state.flags & 0x0200 && state.wrap & 4) {
                state.check = crc32_1(state.check, input, copy, next)
              }
              have -= copy
              next += copy
              state.length -= copy
            }
            if (state.length) {
              break inf_leave
            }
          }
          state.length = 0
          state.mode = NAME
        /* falls through */
        case NAME:
          if (state.flags & 0x0800) {
            if (have === 0) {
              break inf_leave
            }
            copy = 0
            do {
              // TODO: 2 or 1 bytes?
              len = input[next + copy++]
              /* use constant limit because in js we should not preallocate memory */
              if (
                state.head &&
                len &&
                state.length < 65536 /*state.head.name_max*/
              ) {
                state.head.name += String.fromCharCode(len)
              }
            } while (len && copy < have)

            if (state.flags & 0x0200 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next)
            }
            have -= copy
            next += copy
            if (len) {
              break inf_leave
            }
          } else if (state.head) {
            state.head.name = null
          }
          state.length = 0
          state.mode = COMMENT
        /* falls through */
        case COMMENT:
          if (state.flags & 0x1000) {
            if (have === 0) {
              break inf_leave
            }
            copy = 0
            do {
              len = input[next + copy++]
              /* use constant limit because in js we should not preallocate memory */
              if (
                state.head &&
                len &&
                state.length < 65536 /*state.head.comm_max*/
              ) {
                state.head.comment += String.fromCharCode(len)
              }
            } while (len && copy < have)
            if (state.flags & 0x0200 && state.wrap & 4) {
              state.check = crc32_1(state.check, input, copy, next)
            }
            have -= copy
            next += copy
            if (len) {
              break inf_leave
            }
          } else if (state.head) {
            state.head.comment = null
          }
          state.mode = HCRC
        /* falls through */
        case HCRC:
          if (state.flags & 0x0200) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            if (state.wrap & 4 && hold !== (state.check & 0xffff)) {
              strm.msg = 'header crc mismatch'
              state.mode = BAD
              break
            }
            //=== INITBITS();
            hold = 0
            bits = 0
            //===//
          }
          if (state.head) {
            state.head.hcrc = (state.flags >> 9) & 1
            state.head.done = true
          }
          strm.adler = state.check = 0
          state.mode = TYPE
          break
        case DICTID:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          strm.adler = state.check = zswap32(hold)
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = DICT
        /* falls through */
        case DICT:
          if (state.havedict === 0) {
            //--- RESTORE() ---
            strm.next_out = put
            strm.avail_out = left
            strm.next_in = next
            strm.avail_in = have
            state.hold = hold
            state.bits = bits
            //---
            return Z_NEED_DICT$1
          }
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/
          state.mode = TYPE
        /* falls through */
        case TYPE:
          if (flush === Z_BLOCK || flush === Z_TREES) {
            break inf_leave
          }
        /* falls through */
        case TYPEDO:
          if (state.last) {
            //--- BYTEBITS() ---//
            hold >>>= bits & 7
            bits -= bits & 7
            //---//
            state.mode = CHECK
            break
          }
          //=== NEEDBITS(3); */
          while (bits < 3) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.last = hold & 0x01 /*BITS(1)*/
          //--- DROPBITS(1) ---//
          hold >>>= 1
          bits -= 1
          //---//

          switch (hold & 0x03 /*BITS(2)*/) {
            case 0 /* stored block */:
              //Tracev((stderr, "inflate:     stored block%s\n",
              //        state.last ? " (last)" : ""));
              state.mode = STORED
              break
            case 1 /* fixed block */:
              fixedtables(state)
              //Tracev((stderr, "inflate:     fixed codes block%s\n",
              //        state.last ? " (last)" : ""));
              state.mode = LEN_ /* decode codes */
              if (flush === Z_TREES) {
                //--- DROPBITS(2) ---//
                hold >>>= 2
                bits -= 2
                //---//
                break inf_leave
              }
              break
            case 2 /* dynamic block */:
              //Tracev((stderr, "inflate:     dynamic codes block%s\n",
              //        state.last ? " (last)" : ""));
              state.mode = TABLE
              break
            case 3:
              strm.msg = 'invalid block type'
              state.mode = BAD
          }
          //--- DROPBITS(2) ---//
          hold >>>= 2
          bits -= 2
          //---//
          break
        case STORED:
          //--- BYTEBITS() ---// /* go to byte boundary */
          hold >>>= bits & 7
          bits -= bits & 7
          //---//
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
            strm.msg = 'invalid stored block lengths'
            state.mode = BAD
            break
          }
          state.length = hold & 0xffff
          //Tracev((stderr, "inflate:       stored length %u\n",
          //        state.length));
          //=== INITBITS();
          hold = 0
          bits = 0
          //===//
          state.mode = COPY_
          if (flush === Z_TREES) {
            break inf_leave
          }
        /* falls through */
        case COPY_:
          state.mode = COPY
        /* falls through */
        case COPY:
          copy = state.length
          if (copy) {
            if (copy > have) {
              copy = have
            }
            if (copy > left) {
              copy = left
            }
            if (copy === 0) {
              break inf_leave
            }
            //--- zmemcpy(put, next, copy); ---
            output.set(input.subarray(next, next + copy), put)
            //---//
            have -= copy
            next += copy
            left -= copy
            put += copy
            state.length -= copy
            break
          }
          //Tracev((stderr, "inflate:       stored end\n"));
          state.mode = TYPE
          break
        case TABLE:
          //=== NEEDBITS(14); */
          while (bits < 14) {
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
          }
          //===//
          state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257
          //--- DROPBITS(5) ---//
          hold >>>= 5
          bits -= 5
          //---//
          state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1
          //--- DROPBITS(5) ---//
          hold >>>= 5
          bits -= 5
          //---//
          state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4
          //--- DROPBITS(4) ---//
          hold >>>= 4
          bits -= 4
          //---//
          //#ifndef PKZIP_BUG_WORKAROUND
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = 'too many length or distance symbols'
            state.mode = BAD
            break
          }
          //#endif
          //Tracev((stderr, "inflate:       table sizes ok\n"));
          state.have = 0
          state.mode = LENLENS
        /* falls through */
        case LENLENS:
          while (state.have < state.ncode) {
            //=== NEEDBITS(3);
            while (bits < 3) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            state.lens[order[state.have++]] = hold & 0x07 //BITS(3);
            //--- DROPBITS(3) ---//
            hold >>>= 3
            bits -= 3
            //---//
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0
          }
          // We have separate tables & no pointers. 2 commented lines below not needed.
          //state.next = state.codes;
          //state.lencode = state.next;
          // Switch to use dynamic table
          state.lencode = state.lendyn
          state.lenbits = 7

          opts = { bits: state.lenbits }
          ret = inftrees(
            CODES,
            state.lens,
            0,
            19,
            state.lencode,
            0,
            state.work,
            opts
          )
          state.lenbits = opts.bits

          if (ret) {
            strm.msg = 'invalid code lengths set'
            state.mode = BAD
            break
          }
          //Tracev((stderr, "inflate:       code lengths ok\n"));
          state.have = 0
          state.mode = CODELENS
        /* falls through */
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (;;) {
              here =
                state.lencode[
                  hold & ((1 << state.lenbits) - 1)
                ] /*BITS(state.lenbits)*/
              here_bits = here >>> 24
              here_op = (here >>> 16) & 0xff
              here_val = here & 0xffff

              if (here_bits <= bits) {
                break
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
              //---//
            }
            if (here_val < 16) {
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits
              bits -= here_bits
              //---//
              state.lens[state.have++] = here_val
            } else {
              if (here_val === 16) {
                //=== NEEDBITS(here.bits + 2);
                n = here_bits + 2
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave
                  }
                  have--
                  hold += input[next++] << bits
                  bits += 8
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits
                bits -= here_bits
                //---//
                if (state.have === 0) {
                  strm.msg = 'invalid bit length repeat'
                  state.mode = BAD
                  break
                }
                len = state.lens[state.have - 1]
                copy = 3 + (hold & 0x03) //BITS(2);
                //--- DROPBITS(2) ---//
                hold >>>= 2
                bits -= 2
                //---//
              } else if (here_val === 17) {
                //=== NEEDBITS(here.bits + 3);
                n = here_bits + 3
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave
                  }
                  have--
                  hold += input[next++] << bits
                  bits += 8
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits
                bits -= here_bits
                //---//
                len = 0
                copy = 3 + (hold & 0x07) //BITS(3);
                //--- DROPBITS(3) ---//
                hold >>>= 3
                bits -= 3
                //---//
              } else {
                //=== NEEDBITS(here.bits + 7);
                n = here_bits + 7
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave
                  }
                  have--
                  hold += input[next++] << bits
                  bits += 8
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits
                bits -= here_bits
                //---//
                len = 0
                copy = 11 + (hold & 0x7f) //BITS(7);
                //--- DROPBITS(7) ---//
                hold >>>= 7
                bits -= 7
                //---//
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = 'invalid bit length repeat'
                state.mode = BAD
                break
              }
              while (copy--) {
                state.lens[state.have++] = len
              }
            }
          }

          /* handle error breaks in while */
          if (state.mode === BAD) {
            break
          }

          /* check for end-of-block code (better have one) */
          if (state.lens[256] === 0) {
            strm.msg = 'invalid code -- missing end-of-block'
            state.mode = BAD
            break
          }

          /* build code tables -- note: do not change the lenbits or distbits
             values here (9 and 6) without reading the comments in inftrees.h
             concerning the ENOUGH constants, which depend on those values */
          state.lenbits = 9

          opts = { bits: state.lenbits }
          ret = inftrees(
            LENS,
            state.lens,
            0,
            state.nlen,
            state.lencode,
            0,
            state.work,
            opts
          )
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.lenbits = opts.bits
          // state.lencode = state.next;

          if (ret) {
            strm.msg = 'invalid literal/lengths set'
            state.mode = BAD
            break
          }

          state.distbits = 6
          //state.distcode.copy(state.codes);
          // Switch to use dynamic table
          state.distcode = state.distdyn
          opts = { bits: state.distbits }
          ret = inftrees(
            DISTS,
            state.lens,
            state.nlen,
            state.ndist,
            state.distcode,
            0,
            state.work,
            opts
          )
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.distbits = opts.bits
          // state.distcode = state.next;

          if (ret) {
            strm.msg = 'invalid distances set'
            state.mode = BAD
            break
          }
          //Tracev((stderr, 'inflate:       codes ok\n'));
          state.mode = LEN_
          if (flush === Z_TREES) {
            break inf_leave
          }
        /* falls through */
        case LEN_:
          state.mode = LEN
        /* falls through */
        case LEN:
          if (have >= 6 && left >= 258) {
            //--- RESTORE() ---
            strm.next_out = put
            strm.avail_out = left
            strm.next_in = next
            strm.avail_in = have
            state.hold = hold
            state.bits = bits
            //---
            inffast(strm, _out)
            //--- LOAD() ---
            put = strm.next_out
            output = strm.output
            left = strm.avail_out
            next = strm.next_in
            input = strm.input
            have = strm.avail_in
            hold = state.hold
            bits = state.bits
            //---

            if (state.mode === TYPE) {
              state.back = -1
            }
            break
          }
          state.back = 0
          for (;;) {
            here =
              state.lencode[
                hold & ((1 << state.lenbits) - 1)
              ] /*BITS(state.lenbits)*/
            here_bits = here >>> 24
            here_op = (here >>> 16) & 0xff
            here_val = here & 0xffff

            if (here_bits <= bits) {
              break
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
            //---//
          }
          if (here_op && (here_op & 0xf0) === 0) {
            last_bits = here_bits
            last_op = here_op
            last_val = here_val
            for (;;) {
              here =
                state.lencode[
                  last_val +
                    ((hold &
                      ((1 << (last_bits + last_op)) -
                        1)) /*BITS(last.bits + last.op)*/ >>
                      last_bits)
                ]
              here_bits = here >>> 24
              here_op = (here >>> 16) & 0xff
              here_val = here & 0xffff

              if (last_bits + here_bits <= bits) {
                break
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits
            bits -= last_bits
            //---//
            state.back += last_bits
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits
          bits -= here_bits
          //---//
          state.back += here_bits
          state.length = here_val
          if (here_op === 0) {
            //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
            //        "inflate:         literal '%c'\n" :
            //        "inflate:         literal 0x%02x\n", here.val));
            state.mode = LIT
            break
          }
          if (here_op & 32) {
            //Tracevv((stderr, "inflate:         end of block\n"));
            state.back = -1
            state.mode = TYPE
            break
          }
          if (here_op & 64) {
            strm.msg = 'invalid literal/length code'
            state.mode = BAD
            break
          }
          state.extra = here_op & 15
          state.mode = LENEXT
        /* falls through */
        case LENEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra
            while (bits < n) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            state.length +=
              hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra
            bits -= state.extra
            //---//
            state.back += state.extra
          }
          //Tracevv((stderr, "inflate:         length %u\n", state.length));
          state.was = state.length
          state.mode = DIST
        /* falls through */
        case DIST:
          for (;;) {
            here =
              state.distcode[
                hold & ((1 << state.distbits) - 1)
              ] /*BITS(state.distbits)*/
            here_bits = here >>> 24
            here_op = (here >>> 16) & 0xff
            here_val = here & 0xffff

            if (here_bits <= bits) {
              break
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave
            }
            have--
            hold += input[next++] << bits
            bits += 8
            //---//
          }
          if ((here_op & 0xf0) === 0) {
            last_bits = here_bits
            last_op = here_op
            last_val = here_val
            for (;;) {
              here =
                state.distcode[
                  last_val +
                    ((hold &
                      ((1 << (last_bits + last_op)) -
                        1)) /*BITS(last.bits + last.op)*/ >>
                      last_bits)
                ]
              here_bits = here >>> 24
              here_op = (here >>> 16) & 0xff
              here_val = here & 0xffff

              if (last_bits + here_bits <= bits) {
                break
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits
            bits -= last_bits
            //---//
            state.back += last_bits
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits
          bits -= here_bits
          //---//
          state.back += here_bits
          if (here_op & 64) {
            strm.msg = 'invalid distance code'
            state.mode = BAD
            break
          }
          state.offset = here_val
          state.extra = here_op & 15
          state.mode = DISTEXT
        /* falls through */
        case DISTEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra
            while (bits < n) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            state.offset +=
              hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra
            bits -= state.extra
            //---//
            state.back += state.extra
          }
          //#ifdef INFLATE_STRICT
          if (state.offset > state.dmax) {
            strm.msg = 'invalid distance too far back'
            state.mode = BAD
            break
          }
          //#endif
          //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
          state.mode = MATCH
        /* falls through */
        case MATCH:
          if (left === 0) {
            break inf_leave
          }
          copy = _out - left
          if (state.offset > copy) {
            /* copy from window */
            copy = state.offset - copy
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = 'invalid distance too far back'
                state.mode = BAD
                break
              }
              // (!) This block is disabled in zlib defaults,
              // don't enable it for binary compatibility
              //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
              //          Trace((stderr, "inflate.c too far\n"));
              //          copy -= state.whave;
              //          if (copy > state.length) { copy = state.length; }
              //          if (copy > left) { copy = left; }
              //          left -= copy;
              //          state.length -= copy;
              //          do {
              //            output[put++] = 0;
              //          } while (--copy);
              //          if (state.length === 0) { state.mode = LEN; }
              //          break;
              //#endif
            }
            if (copy > state.wnext) {
              copy -= state.wnext
              from = state.wsize - copy
            } else {
              from = state.wnext - copy
            }
            if (copy > state.length) {
              copy = state.length
            }
            from_source = state.window
          } else {
            /* copy from output */
            from_source = output
            from = put - state.offset
            copy = state.length
          }
          if (copy > left) {
            copy = left
          }
          left -= copy
          state.length -= copy
          do {
            output[put++] = from_source[from++]
          } while (--copy)
          if (state.length === 0) {
            state.mode = LEN
          }
          break
        case LIT:
          if (left === 0) {
            break inf_leave
          }
          output[put++] = state.length
          left--
          state.mode = LEN
          break
        case CHECK:
          if (state.wrap) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave
              }
              have--
              // Use '|' instead of '+' to make sure that result is signed
              hold |= input[next++] << bits
              bits += 8
            }
            //===//
            _out -= left
            strm.total_out += _out
            state.total += _out
            if (state.wrap & 4 && _out) {
              strm.adler = state.check =
                /*UPDATE_CHECK(state.check, put - _out, _out);*/
                state.flags
                  ? crc32_1(state.check, output, _out, put - _out)
                  : adler32_1(state.check, output, _out, put - _out)
            }
            _out = left
            // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
            if (
              state.wrap & 4 &&
              (state.flags ? hold : zswap32(hold)) !== state.check
            ) {
              strm.msg = 'incorrect data check'
              state.mode = BAD
              break
            }
            //=== INITBITS();
            hold = 0
            bits = 0
            //===//
            //Tracev((stderr, "inflate:   check matches trailer\n"));
          }
          state.mode = LENGTH
        /* falls through */
        case LENGTH:
          if (state.wrap && state.flags) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave
              }
              have--
              hold += input[next++] << bits
              bits += 8
            }
            //===//
            if (state.wrap & 4 && hold !== (state.total & 0xffffffff)) {
              strm.msg = 'incorrect length check'
              state.mode = BAD
              break
            }
            //=== INITBITS();
            hold = 0
            bits = 0
            //===//
            //Tracev((stderr, "inflate:   length matches trailer\n"));
          }
          state.mode = DONE
        /* falls through */
        case DONE:
          ret = Z_STREAM_END$1
          break inf_leave
        case BAD:
          ret = Z_DATA_ERROR$1
          break inf_leave
        case MEM:
          return Z_MEM_ERROR$1
        case SYNC:
        /* falls through */
        default:
          return Z_STREAM_ERROR$1
      }
    }

    // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

    /*
       Return from inflate(), updating the total counts and the check value.
       If there was no progress during the inflate() call, return a buffer
       error.  Call updatewindow() to create and/or update the window state.
       Note: a memory error from inflate() is non-recoverable.
     */

    //--- RESTORE() ---
    strm.next_out = put
    strm.avail_out = left
    strm.next_in = next
    strm.avail_in = have
    state.hold = hold
    state.bits = bits
    //---

    if (
      state.wsize ||
      (_out !== strm.avail_out &&
        state.mode < BAD &&
        (state.mode < CHECK || flush !== Z_FINISH$1))
    ) {
      if (
        updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)
      );
    }
    _in -= strm.avail_in
    _out -= strm.avail_out
    strm.total_in += _in
    strm.total_out += _out
    state.total += _out
    if (state.wrap & 4 && _out) {
      strm.adler = state.check =
        /*UPDATE_CHECK(state.check, strm.next_out - _out, _out);*/
        state.flags
          ? crc32_1(state.check, output, _out, strm.next_out - _out)
          : adler32_1(state.check, output, _out, strm.next_out - _out)
    }
    strm.data_type =
      state.bits +
      (state.last ? 64 : 0) +
      (state.mode === TYPE ? 128 : 0) +
      (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0)
    if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR
    }
    return ret
  }

  const inflateEnd = (strm) => {
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }

    let state = strm.state
    if (state.window) {
      state.window = null
    }
    strm.state = null
    return Z_OK$1
  }

  const inflateGetHeader = (strm, head) => {
    /* check state */
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }
    const state = strm.state
    if ((state.wrap & 2) === 0) {
      return Z_STREAM_ERROR$1
    }

    /* save header structure */
    state.head = head
    head.done = false
    return Z_OK$1
  }

  const inflateSetDictionary = (strm, dictionary) => {
    const dictLength = dictionary.length

    let state
    let dictid
    let ret

    /* check state */
    if (inflateStateCheck(strm)) {
      return Z_STREAM_ERROR$1
    }
    state = strm.state

    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR$1
    }

    /* check for correct dictionary identifier */
    if (state.mode === DICT) {
      dictid = 1 /* adler32(0, null, 0)*/
      /* dictid = adler32(dictid, dictionary, dictLength); */
      dictid = adler32_1(dictid, dictionary, dictLength, 0)
      if (dictid !== state.check) {
        return Z_DATA_ERROR$1
      }
    }
    /* copy dictionary to window using updatewindow(), which will amend the
     existing dictionary if appropriate */
    ret = updatewindow(strm, dictionary, dictLength, dictLength)
    if (ret) {
      state.mode = MEM
      return Z_MEM_ERROR$1
    }
    state.havedict = 1
    // Tracev((stderr, "inflate:   dictionary set\n"));
    return Z_OK$1
  }

  var inflateReset_1 = inflateReset
  var inflateReset2_1 = inflateReset2
  var inflateResetKeep_1 = inflateResetKeep
  var inflateInit_1 = inflateInit
  var inflateInit2_1 = inflateInit2
  var inflate_2$1 = inflate$2
  var inflateEnd_1 = inflateEnd
  var inflateGetHeader_1 = inflateGetHeader
  var inflateSetDictionary_1 = inflateSetDictionary
  var inflateInfo = 'pako inflate (from Nodeca project)'

  /* Not implemented
  module.exports.inflateCodesUsed = inflateCodesUsed;
  module.exports.inflateCopy = inflateCopy;
  module.exports.inflateGetDictionary = inflateGetDictionary;
  module.exports.inflateMark = inflateMark;
  module.exports.inflatePrime = inflatePrime;
  module.exports.inflateSync = inflateSync;
  module.exports.inflateSyncPoint = inflateSyncPoint;
  module.exports.inflateUndermine = inflateUndermine;
  module.exports.inflateValidate = inflateValidate;
  */

  var inflate_1$2 = {
    inflateReset: inflateReset_1,
    inflateReset2: inflateReset2_1,
    inflateResetKeep: inflateResetKeep_1,
    inflateInit: inflateInit_1,
    inflateInit2: inflateInit2_1,
    inflate: inflate_2$1,
    inflateEnd: inflateEnd_1,
    inflateGetHeader: inflateGetHeader_1,
    inflateSetDictionary: inflateSetDictionary_1,
    inflateInfo: inflateInfo
  }

  // (C) 1995-2013 Jean-loup Gailly and Mark Adler
  // (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
  //
  // This software is provided 'as-is', without any express or implied
  // warranty. In no event will the authors be held liable for any damages
  // arising from the use of this software.
  //
  // Permission is granted to anyone to use this software for any purpose,
  // including commercial applications, and to alter it and redistribute it
  // freely, subject to the following restrictions:
  //
  // 1. The origin of this software must not be misrepresented; you must not
  //   claim that you wrote the original software. If you use this software
  //   in a product, an acknowledgment in the product documentation would be
  //   appreciated but is not required.
  // 2. Altered source versions must be plainly marked as such, and must not be
  //   misrepresented as being the original software.
  // 3. This notice may not be removed or altered from any source distribution.

  function GZheader() {
    /* true if compressed data believed to be text */
    this.text = 0
    /* modification time */
    this.time = 0
    /* extra flags (not used when writing a gzip file) */
    this.xflags = 0
    /* operating system */
    this.os = 0
    /* pointer to extra field or Z_NULL if none */
    this.extra = null
    /* extra field length (valid if extra != Z_NULL) */
    this.extra_len = 0 // Actually, we don't need it in JS,
    // but leave for few code modifications

    //
    // Setup limits is not necessary because in js we should not preallocate memory
    // for inflate use constant limit in 65536 bytes
    //

    /* space at extra (only when reading header) */
    // this.extra_max  = 0;
    /* pointer to zero-terminated file name or Z_NULL */
    this.name = ''
    /* space at name (only when reading header) */
    // this.name_max   = 0;
    /* pointer to zero-terminated comment or Z_NULL */
    this.comment = ''
    /* space at comment (only when reading header) */
    // this.comm_max   = 0;
    /* true if there was or will be a header crc */
    this.hcrc = 0
    /* true when done reading gzip header (not used when writing a gzip file) */
    this.done = false
  }

  var gzheader = GZheader

  const toString = Object.prototype.toString

  /* Public constants ==========================================================*/
  /* ===========================================================================*/

  const {
    Z_NO_FLUSH,
    Z_FINISH,
    Z_OK,
    Z_STREAM_END,
    Z_NEED_DICT,
    Z_STREAM_ERROR,
    Z_DATA_ERROR,
    Z_MEM_ERROR
  } = constants$2

  /* ===========================================================================*/

  /**
   * class Inflate
   *
   * Generic JS-style wrapper for zlib calls. If you don't need
   * streaming behaviour - use more simple functions: [[inflate]]
   * and [[inflateRaw]].
   **/

  /* internal
   * inflate.chunks -> Array
   *
   * Chunks of output data, if [[Inflate#onData]] not overridden.
   **/

  /**
   * Inflate.result -> Uint8Array|String
   *
   * Uncompressed result, generated by default [[Inflate#onData]]
   * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
   * (call [[Inflate#push]] with `Z_FINISH` / `true` param).
   **/

  /**
   * Inflate.err -> Number
   *
   * Error code after inflate finished. 0 (Z_OK) on success.
   * Should be checked if broken data possible.
   **/

  /**
   * Inflate.msg -> String
   *
   * Error message, if [[Inflate.err]] != 0
   **/

  /**
   * new Inflate(options)
   * - options (Object): zlib inflate options.
   *
   * Creates new inflator instance with specified params. Throws exception
   * on bad params. Supported options:
   *
   * - `windowBits`
   * - `dictionary`
   *
   * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
   * for more information on these.
   *
   * Additional options, for internal needs:
   *
   * - `chunkSize` - size of generated data chunks (16K by default)
   * - `raw` (Boolean) - do raw inflate
   * - `to` (String) - if equal to 'string', then result will be converted
   *   from utf8 to utf16 (javascript) string. When string output requested,
   *   chunk length can differ from `chunkSize`, depending on content.
   *
   * By default, when no options set, autodetect deflate/gzip data format via
   * wrapper header.
   *
   * ##### Example:
   *
   * ```javascript
   * const pako = require('pako')
   * const chunk1 = new Uint8Array([1,2,3,4,5,6,7,8,9])
   * const chunk2 = new Uint8Array([10,11,12,13,14,15,16,17,18,19]);
   *
   * const inflate = new pako.Inflate({ level: 3});
   *
   * inflate.push(chunk1, false);
   * inflate.push(chunk2, true);  // true -> last chunk
   *
   * if (inflate.err) { throw new Error(inflate.err); }
   *
   * console.log(inflate.result);
   * ```
   **/
  function Inflate$1(options) {
    this.options = common.assign(
      {
        chunkSize: 1024 * 64,
        windowBits: 15,
        to: ''
      },
      options || {}
    )

    const opt = this.options

    // Force window size for `raw` data, if not set directly,
    // because we have no header for autodetect.
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits
      if (opt.windowBits === 0) {
        opt.windowBits = -15
      }
    }

    // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
    if (
      opt.windowBits >= 0 &&
      opt.windowBits < 16 &&
      !(options && options.windowBits)
    ) {
      opt.windowBits += 32
    }

    // Gzip header has no info about windows size, we can do autodetect only
    // for deflate. So, if window size not set, force it to max when gzip possible
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      // bit 3 (16) -> gzipped data
      // bit 4 (32) -> autodetect gzip/deflate
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15
      }
    }

    this.err = 0 // error code, if happens (0 = Z_OK)
    this.msg = '' // error message
    this.ended = false // used to avoid multiple onEnd() calls
    this.chunks = [] // chunks of compressed data

    this.strm = new zstream()
    this.strm.avail_out = 0

    let status = inflate_1$2.inflateInit2(this.strm, opt.windowBits)

    if (status !== Z_OK) {
      throw new Error(messages[status])
    }

    this.header = new gzheader()

    inflate_1$2.inflateGetHeader(this.strm, this.header)

    // Setup dictionary
    if (opt.dictionary) {
      // Convert data if needed
      if (typeof opt.dictionary === 'string') {
        opt.dictionary = strings.string2buf(opt.dictionary)
      } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
        opt.dictionary = new Uint8Array(opt.dictionary)
      }
      if (opt.raw) {
        //In raw mode we need to set the dictionary early
        status = inflate_1$2.inflateSetDictionary(this.strm, opt.dictionary)
        if (status !== Z_OK) {
          throw new Error(messages[status])
        }
      }
    }
  }

  /**
   * Inflate#push(data[, flush_mode]) -> Boolean
   * - data (Uint8Array|ArrayBuffer): input data
   * - flush_mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE
   *   flush modes. See constants. Skipped or `false` means Z_NO_FLUSH,
   *   `true` means Z_FINISH.
   *
   * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
   * new output chunks. Returns `true` on success. If end of stream detected,
   * [[Inflate#onEnd]] will be called.
   *
   * `flush_mode` is not needed for normal operation, because end of stream
   * detected automatically. You may try to use it for advanced things, but
   * this functionality was not tested.
   *
   * On fail call [[Inflate#onEnd]] with error code and return false.
   *
   * ##### Example
   *
   * ```javascript
   * push(chunk, false); // push one of data chunks
   * ...
   * push(chunk, true);  // push last chunk
   * ```
   **/
  Inflate$1.prototype.push = function (data, flush_mode) {
    const strm = this.strm
    const chunkSize = this.options.chunkSize
    const dictionary = this.options.dictionary
    let status, _flush_mode, last_avail_out

    if (this.ended) return false

    if (flush_mode === ~~flush_mode) _flush_mode = flush_mode
    else _flush_mode = flush_mode === true ? Z_FINISH : Z_NO_FLUSH

    // Convert data if needed
    if (toString.call(data) === '[object ArrayBuffer]') {
      strm.input = new Uint8Array(data)
    } else {
      strm.input = data
    }

    strm.next_in = 0
    strm.avail_in = strm.input.length

    for (;;) {
      if (strm.avail_out === 0) {
        strm.output = new Uint8Array(chunkSize)
        strm.next_out = 0
        strm.avail_out = chunkSize
      }

      status = inflate_1$2.inflate(strm, _flush_mode)

      if (status === Z_NEED_DICT && dictionary) {
        status = inflate_1$2.inflateSetDictionary(strm, dictionary)

        if (status === Z_OK) {
          status = inflate_1$2.inflate(strm, _flush_mode)
        } else if (status === Z_DATA_ERROR) {
          // Replace code with more verbose
          status = Z_NEED_DICT
        }
      }

      // Skip snyc markers if more data follows and not raw mode
      while (
        strm.avail_in > 0 &&
        status === Z_STREAM_END &&
        strm.state.wrap > 0 &&
        data[strm.next_in] !== 0
      ) {
        inflate_1$2.inflateReset(strm)
        status = inflate_1$2.inflate(strm, _flush_mode)
      }

      switch (status) {
        case Z_STREAM_ERROR:
        case Z_DATA_ERROR:
        case Z_NEED_DICT:
        case Z_MEM_ERROR:
          this.onEnd(status)
          this.ended = true
          return false
      }

      // Remember real `avail_out` value, because we may patch out buffer content
      // to align utf8 strings boundaries.
      last_avail_out = strm.avail_out

      if (strm.next_out) {
        if (strm.avail_out === 0 || status === Z_STREAM_END) {
          if (this.options.to === 'string') {
            let next_out_utf8 = strings.utf8border(strm.output, strm.next_out)

            let tail = strm.next_out - next_out_utf8
            let utf8str = strings.buf2string(strm.output, next_out_utf8)

            // move tail & realign counters
            strm.next_out = tail
            strm.avail_out = chunkSize - tail
            if (tail)
              strm.output.set(
                strm.output.subarray(next_out_utf8, next_out_utf8 + tail),
                0
              )

            this.onData(utf8str)
          } else {
            this.onData(
              strm.output.length === strm.next_out
                ? strm.output
                : strm.output.subarray(0, strm.next_out)
            )
          }
        }
      }

      // Must repeat iteration if out buffer is full
      if (status === Z_OK && last_avail_out === 0) continue

      // Finalize if end of stream reached.
      if (status === Z_STREAM_END) {
        status = inflate_1$2.inflateEnd(this.strm)
        this.onEnd(status)
        this.ended = true
        return true
      }

      if (strm.avail_in === 0) break
    }

    return true
  }

  /**
   * Inflate#onData(chunk) -> Void
   * - chunk (Uint8Array|String): output data. When string output requested,
   *   each chunk will be string.
   *
   * By default, stores data blocks in `chunks[]` property and glue
   * those in `onEnd`. Override this handler, if you need another behaviour.
   **/
  Inflate$1.prototype.onData = function (chunk) {
    this.chunks.push(chunk)
  }

  /**
   * Inflate#onEnd(status) -> Void
   * - status (Number): inflate status. 0 (Z_OK) on success,
   *   other if not.
   *
   * Called either after you tell inflate that the input stream is
   * complete (Z_FINISH). By default - join collected chunks,
   * free memory and fill `results` / `err` properties.
   **/
  Inflate$1.prototype.onEnd = function (status) {
    // On success - join
    if (status === Z_OK) {
      if (this.options.to === 'string') {
        this.result = this.chunks.join('')
      } else {
        this.result = common.flattenChunks(this.chunks)
      }
    }
    this.chunks = []
    this.err = status
    this.msg = this.strm.msg
  }

  /**
   * inflate(data[, options]) -> Uint8Array|String
   * - data (Uint8Array|ArrayBuffer): input data to decompress.
   * - options (Object): zlib inflate options.
   *
   * Decompress `data` with inflate/ungzip and `options`. Autodetect
   * format via wrapper header by default. That's why we don't provide
   * separate `ungzip` method.
   *
   * Supported options are:
   *
   * - windowBits
   *
   * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
   * for more information.
   *
   * Sugar (options):
   *
   * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
   *   negative windowBits implicitly.
   * - `to` (String) - if equal to 'string', then result will be converted
   *   from utf8 to utf16 (javascript) string. When string output requested,
   *   chunk length can differ from `chunkSize`, depending on content.
   *
   *
   * ##### Example:
   *
   * ```javascript
   * const pako = require('pako');
   * const input = pako.deflate(new Uint8Array([1,2,3,4,5,6,7,8,9]));
   * let output;
   *
   * try {
   *   output = pako.inflate(input);
   * } catch (err) {
   *   console.log(err);
   * }
   * ```
   **/
  function inflate$1(input, options) {
    const inflator = new Inflate$1(options)

    inflator.push(input)

    // That will never happens, if you don't cheat with options :)
    if (inflator.err) throw inflator.msg || messages[inflator.err]

    return inflator.result
  }

  /**
   * inflateRaw(data[, options]) -> Uint8Array|String
   * - data (Uint8Array|ArrayBuffer): input data to decompress.
   * - options (Object): zlib inflate options.
   *
   * The same as [[inflate]], but creates raw data, without wrapper
   * (header and adler32 crc).
   **/
  function inflateRaw$1(input, options) {
    options = options || {}
    options.raw = true
    return inflate$1(input, options)
  }

  /**
   * ungzip(data[, options]) -> Uint8Array|String
   * - data (Uint8Array|ArrayBuffer): input data to decompress.
   * - options (Object): zlib inflate options.
   *
   * Just shortcut to [[inflate]], because it autodetects format
   * by header.content. Done for convenience.
   **/

  var Inflate_1$1 = Inflate$1
  var inflate_2 = inflate$1
  var inflateRaw_1$1 = inflateRaw$1
  var ungzip$1 = inflate$1
  var constants = constants$2

  var inflate_1$1 = {
    Inflate: Inflate_1$1,
    inflate: inflate_2,
    inflateRaw: inflateRaw_1$1,
    ungzip: ungzip$1,
    constants: constants
  }

  const { Deflate, deflate, deflateRaw, gzip } = deflate_1$1

  const { Inflate, inflate, inflateRaw, ungzip } = inflate_1$1

  var Deflate_1 = Deflate
  var deflate_1 = deflate
  var deflateRaw_1 = deflateRaw
  var gzip_1 = gzip
  var Inflate_1 = Inflate
  var inflate_1 = inflate
  var inflateRaw_1 = inflateRaw
  var ungzip_1 = ungzip
  var constants_1 = constants$2

  var pako = {
    Deflate: Deflate_1,
    deflate: deflate_1,
    deflateRaw: deflateRaw_1,
    gzip: gzip_1,
    Inflate: Inflate_1,
    inflate: inflate_1,
    inflateRaw: inflateRaw_1,
    ungzip: ungzip_1,
    constants: constants_1
  }

  var cache$1 = {}

  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&')
  }
  /**
   * Replaces variable placeholders inside a string with any given data. Each key
   * in `data` corresponds to a variable placeholder name in `str`.
   *
   * Usage:
   * {{{
   * template('My name is ${name} and I am ${age} years old.', { name: 'Bob', age: '65' });
   * }}}
   *
   * @param  String str     A string containing variable place-holders.
   * @param  Object data    A key, value array where each key stands for a place-holder variable
   *                        name to be replaced with value.
   * @param  Object options Available options are:
   *                        - `'before'`: The character or string in front of the name of the variable
   *                          place-holder (defaults to `'${'`).
   *                        - `'after'`: The character or string after the name of the variable
   *                          place-holder (defaults to `}`).
   *                        - `'escape'`: The character or string used to escape the before character or string
   *                          (defaults to `'\\'`).
   *                        - `'clean'`: A boolean or array with instructions for cleaning.
   * @return String
   */
  function template(str, data, options) {
    var data = data || {}
    var options = options || {}

    var keys = Array.isArray(data)
      ? Array.apply(null, { length: data.length }).map(Number.call, Number)
      : Object.keys(data)
    var len = keys.length

    if (!len) {
      return str
    }

    var before = options.before !== undefined ? options.before : '${'
    var after = options.after !== undefined ? options.after : '}'
    var escape = options.escape !== undefined ? options.escape : '\\'
    var clean = options.clean !== undefined ? options.clean : false

    cache$1[escape] = cache$1[escape] || escapeRegExp(escape)
    cache$1[before] = cache$1[before] || escapeRegExp(before)
    cache$1[after] = cache$1[after] || escapeRegExp(after)

    var begin = escape
      ? '(' + cache$1[escape] + ')?' + cache$1[before]
      : cache$1[before]
    var end = cache$1[after]

    for (var i = 0; i < len; i++) {
      str = str.replace(
        new RegExp(begin + String(keys[i]) + end, 'g'),
        function (match, behind) {
          return behind ? match : String(data[keys[i]])
        }
      )
    }

    if (escape) {
      str = str.replace(
        new RegExp(escapeRegExp(escape) + escapeRegExp(before), 'g'),
        before
      )
    }
    return clean ? template.clean(str, options) : str
  }

  /**
   * Cleans up a formatted string with given `options` depending
   * on the `'clean'` option. The goal of this function is to replace all whitespace
   * and unneeded mark-up around place-holders that did not get replaced by `Text::insert()`.
   *
   * @param  String str     The string to clean.
   * @param  Object options Available options are:
   *                        - `'before'`: characters marking the start of targeted substring.
   *                        - `'after'`: characters marking the end of targeted substring.
   *                        - `'escape'`: The character or string used to escape the before character or string
   *                          (defaults to `'\\'`).
   *                        - `'gap'`: Regular expression matching gaps.
   *                        - `'word'`: Regular expression matching words.
   *                        - `'replacement'`: String to use for cleaned substrings (defaults to `''`).
   * @return String         The cleaned string.
   */
  template.clean = function (str, options) {
    var options = options || {}

    var before = options.before !== undefined ? options.before : '${'
    var after = options.after !== undefined ? options.after : '}'
    var escape = options.escape !== undefined ? options.escape : '\\'
    var word = options.word !== undefined ? options.word : '[\\w,.]+'
    var gap =
      options.gap !== undefined ? options.gap : '(\\s*(?:(?:and|or|,)\\s*)?)'
    var replacement =
      options.replacement !== undefined ? options.replacement : ''

    cache$1[escape] = cache$1[escape] || escapeRegExp(escape)
    cache$1[before] = cache$1[before] || escapeRegExp(before)
    cache$1[after] = cache$1[after] || escapeRegExp(after)

    var begin = escape
      ? '(' + cache$1[escape] + ')?' + cache$1[before]
      : cache$1[before]
    var end = cache$1[after]

    str = str.replace(
      new RegExp(gap + begin + word + end + gap, 'g'),
      function (match, before, behind, after) {
        if (behind) {
          return match
        }
        if (before && after && before.trim() === after.trim()) {
          if (before.trim() || (before && after)) {
            return before + replacement
          }
        }
        return replacement
      }
    )

    if (escape) {
      str = str.replace(
        new RegExp(escapeRegExp(escape) + escapeRegExp(before)),
        before
      )
    }
    return str
  }

  var stringPlaceholder = template

  var template$1 = /*@__PURE__*/ getDefaultExportFromCjs(stringPlaceholder)

  // import logoURL from '../assets/images/dapp-logo-bg.png'
  // import backgroundURL from '../assets/images/background.png'
  // import fontURL from '../assets/fonts/ABSTRACT.ttf'

  /**
   * It has been very hard to allow dual support for browser and nodejs due to dependencies conflicts.
   * This is un ugly unified test for now, should be improved
   */
  var _testDeps = async () => {
    const isNode = typeof process === 'object' && typeof window !== 'object'
    console.info(
      `Running dependencies test on '${isNode ? 'nodejs' : 'browser'}'`
    )
    console.log({ Buffer: Buffer$1 })
    console.log({ safeJSONStringify })
    console.log({ safeJSONStringify })
    console.log({ URLSafeBase64 })
    console.log({ pako })

    //   const jsonUrl = await import('json-url/dist/node/loaders').then(
    //     (d) => d.default
    //   )
    //   console.log({ jsonUrl })
    //   const lzwCodec = await jsonUrl['lzw']()
    //   const lzmaCodec = await jsonUrl['lzma']()

    //const jsonUrl = await import('json-url').then((d) => d.default)
    const jsonUrl = await Promise.resolve()
      .then(function () {
        return jsonUrl$1
      })
      .then((d) => d.default())
      .catch((err) => {
        console.error(err)
        return undefined
      })

    const lzwCodec = jsonUrl('lzw') //jsonUrl ? jsonUrl('lzw') : undefined
    console.log({ lzwCodec })

    //const lzmaCodec = jsonUrl('lzma')
    //   const lzmaLib = await import('lzma/src/lzma_worker.js')
    //   //const lzmaLib = await import('lzma')
    //   console.log({ lzmaLib })
    //   const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
    const lzmaCodec = await Promise.resolve()
      .then(function () {
        return lzma$1
      })
      .then((d) => d.default())
    console.log({ lzmaCodec })
    //const template = await import('string-placeholder').then((d) => d.default)
    //const template = require('string-placeholder')

    console.log({ template: template$1 })

    console.log({
      Buffer: Buffer$1.from('Hello').toString('hex'),
      safeJSONStringify: safeJSONStringify({ foo: 'bar' }),
      URLSafeBase64: encode$1(Buffer$1.from('Hello')),
      pako: Buffer$1.from(
        pako.gzip(Buffer$1.from(safeJSONStringify({ foo: 'bar' }), 'utf-8'))
      ).toString('hex'),
      lzwCodec: jsonUrl
        ? await lzwCodec.compress({ foo: 'bar' })
        : 'disabled due to an error', //It is expected to fail for now

      lzmaCodec: encode$1(
        Buffer$1.from(await lzmaCodec.compress({ foo: 'bar' }))
      ),
      template: template$1(
        'hello {word}',
        { word: 'world' },
        {
          before: '{',
          after: '}'
        }
      )
      // logoURL, //: await import('./assets/images/dapp-logo-bg.png'),
      // backgroundURL, //: await import('./assets/images/background.png')
      // fontURL
    })

    return 'OK'
  }

  const cliName = 'gamechanger-dapp-cli'
  const networks = ['mainnet', 'preprod']
  const apiVersions = ['1', '2']
  const apiEncodings = {
    1: ['json-url-lzw'],
    2: ['json-url-lzma', 'gzip', 'base64url']
  }
  const GCDappConnUrls = {
    1: {
      mainnet: 'https://wallet.gamechanger.finance/api/1/tx/{gcscript}',
      preprod: 'https://preprod-wallet.gamechanger.finance/api/1/tx/{gcscript}'
    },
    2: {
      mainnet: 'https://beta-wallet.gamechanger.finance/api/2/{gcscript}',
      preprod:
        'https://beta-preprod-wallet.gamechanger.finance/api/2/{gcscript}'
    }
  }
  const QRRenderTypes = ['png', 'svg']
  const demoGCS = {
    type: 'tx',
    title: 'Demo',
    description: 'created with ' + cliName,
    metadata: {
      123: {
        message: 'Hello World!'
      }
    }
  }
  const demoPacked =
    'woTCpHR5cGXConR4wqV0aXRsZcKkRGVtb8KrZGVzY3JpcMSKb27DmSHEmGVhdGVkIHfEi2ggZ2FtZWNoYW5nZXItZGFwcC1jbGnCqMSudGHEuMWCwoHCozEyM8KBwqfErnNzYcS0wqxIZWxsbyBXb3JsZCE'
  const escapeShellArg = (arg) =>
    // eslint-disable-next-line quotes
    `'${arg.replace(/'/g, "'\\''")}'`
  const usageMessage = `
GameChanger Wallet CLI:
	Harness the power of Cardano with this simple dApp connector generator for GameChanger Wallet.
	Build GCscripts, JSON-based scripts that gets packed into ready to use URL dApp connectors!

Usage
	$ ${cliName} [network] [action] [subaction]

Networks: ${networks.map((x) => `'${x}'`).join(' | ')}

Actions:
	'encode':
		'url'     : generates a ready to use URL dApp connector from a valid GCScript
		'qr'      : generates a ready to use URL dApp connector encoded into a QR code image from a valid GCScript
		'html'    : generates a ready to use HTML dApp with a URL connector from a valid GCScript
		'button'  : generates a ready to use HTML embeddable button snippet with a URL connector from a valid GCScript
		'nodejs'  : generates a ready to use Node JS dApp with a URL connector from a valid GCScript
		'react'   : generates a ready to use React dApp with a URL connector from a valid GCScript
Options:
	--args [gcscript] | -a [gcscript]:  Load GCScript from arguments
	--file [filename] | -a [filename]:  Load GCScript from file
	without --args or --file         :  Load GCScript from stdin

	--outputFile [filename] -o [filename]:  The QR Code, HTML, button, nodejs, or react output filename
	without --outputFile                 :  Sends the QR Code, HTML, button, nodejs, or react output file to stdin

	--template [template name] | -t [template name]: default, boxed or printable

Examples

	$ ${cliName} mainnet encode url -f demo.gcscript
	https://wallet.gamechanger.finance/api/1/tx/${demoPacked}

	$ ${cliName} preprod encode url -a ${escapeShellArg(JSON.stringify(demoGCS))}
	https://preprod-wallet.gamechanger.finance/api/1/tx/${demoPacked}

	$ cat demo.gcscript | ${cliName} mainnet encode url
	https://wallet.gamechanger.finance/api/1/tx/${demoPacked}

	$ ${cliName} preprod encode qr -a ${escapeShellArg(JSON.stringify(demoGCS))}
	https://preprod-wallet.gamechanger.finance/api/1/tx/${demoPacked} > qr_output.png

	$ ${cliName} preprod encode qr -o qr_output.png -a ${escapeShellArg(
    JSON.stringify(demoGCS)
  )}
	https://preprod-wallet.gamechanger.finance/api/1/tx/${demoPacked} 
`

  const DefaultNetwork = 'mainnet'
  const DefaultAPIVersion = '2'
  const DefaultAPIEncodings = {
    1: 'json-url-lzw',
    2: 'gzip'
  }
  const DefaultQRTemplate = 'boxed'
  const DefaultQRTitle = 'Dapp Connection'
  const DefaultQRSubTitle = 'scan to execute | escanear para ejecutar'

  //import path from 'node:path'
  //import * as path from 'path'
  // export const resolveGlobal = async (file) => {
  //   //const path = await import('path').then(d=>d.default);
  //   var commonjsGlobal =
  //     typeof window !== 'undefined'
  //       ? window
  //       : typeof global !== 'undefined'
  //       ? global
  //       : this
  //   console.log({ path, commonjsGlobal })
  //   if (!commonjsGlobal) throw new Error('Missing global')
  //   return path.resolve('dist/', file)
  // }
  const validateBuildMsgArgs = (args) => {
    const network = args?.network ? args?.network : DefaultNetwork
    if (!networks.includes(network)) {
      throw new Error(
        `Unknown Cardano network specification '${network || ''}'`
      )
    }
    const apiVersion = args?.apiVersion ? args?.apiVersion : DefaultAPIVersion
    if (!apiVersions.includes(apiVersion))
      throw new Error(`Unknown API version '${apiVersion || ''}'`)
    const defaultEncoding = DefaultAPIEncodings[apiVersion]
    const encoding = args?.encoding ? args?.encoding : defaultEncoding
    if (!apiEncodings[apiVersion].includes(encoding))
      throw new Error(
        `Unknown encoding '${encoding || ''}' for API version '${
          apiVersion || ''
        }'`
      )
    const input = args?.input
    if (!input) throw new Error('Empty GCScript provided')
    if (typeof input !== 'string')
      throw new Error(
        'Wrong input type. GCScript must be presented as JSON string'
      )
    return {
      apiVersion,
      network,
      encoding,
      input
    }
  }
  // export const getPlatform = () => {
  //   try {
  //     // Check if the environment is Node.js
  //     if (typeof process === 'object' && typeof require === 'function') {
  //       return 'nodejs'
  //     }
  //   } catch (err) {}
  //   // try {
  //   //   // Check if the environment is a
  //   //   // Service worker
  //   //   if (typeof importScripts === 'function') {
  //   //     return 'worker'
  //   //   }
  //   // } catch (err) {}
  //   try {
  //     // Check if the environment is a Browser
  //     if (typeof window === 'object') {
  //       return 'browser'
  //     }
  //   } catch (err) {}
  // }

  const handler$6 = {
    name: 'GZip',
    encoder: (obj, options) =>
      new Promise(async (resolve, reject) => {
        try {
          const buff = Buffer$1.from(
            pako.gzip(
              Buffer$1.from(safeJSONStringify(obj), 'utf-8'),
              options?.codecOptions || {}
            )
          )
          return resolve(encode$1(buff))
        } catch (err) {
          return reject(err)
        }
      }),
    decoder: (msg, options) =>
      new Promise(async (resolve, reject) => {
        try {
          //const URLSafeBase64 = require('urlsafe-base64')
          //const pako = await import('pako').then((d) => d.default)
          const buff = Buffer$1.from(
            pako.ungzip(
              Buffer$1.from(decode(msg).toString('utf-8'), 'utf-8'),
              options?.codecOptions || {}
            )
          )
          return resolve(JSON.parse(buff.toString('utf-8')))
        } catch (err) {
          return reject(err)
        }
      })
  }

  //import jsonUrl from 'json-url/dist/browser/json-url-single'
  //import jsonUrl from 'json-url/dist/node/index'
  //import lzmaCodec from 'json-url/dist/node/codecs/lzma'
  //const lzmaCodec = jsonUrl.default('lzma')
  //JSON-URL:
  //Very hard to dual import for browser and node at the same time
  // const handler: EncodingHandler = {
  //   name: 'JSON-URL LZMA',
  //   encoder: async (obj: any /*,_options?:any*/) => {
  //     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
  //     const lzmaCodec = jsonUrl('lzma')
  //     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
  //     return lzmaCodec.compress(obj)
  //   },
  //   decoder: async (msg: string /*,_options?:any*/) => {
  //     //const lzmaCodec = await import('json-url').then((d) => d.default('lzma'))
  //     const jsonUrl = await import('../modules/json-url').then((d) => d.default())
  //     const lzmaCodec = jsonUrl('lzma')
  //     return lzmaCodec.decompress(msg)
  //   }
  // }
  //import URLSafeBase64 from 'urlsafe-base64'
  //In-House:
  const handler$5 = {
    name: 'JSON-URL LZMA',
    encoder: async (obj /*,_options?:any*/) => {
      // const lzmaLib = await import(
      //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
      // )
      // // this special condition is present because the web minified version has a slightly different export
      // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
      const lzmaCodec = await Promise.resolve()
        .then(function () {
          return lzma$1
        })
        .then((d) => d.default())
      // we use exact algorithm and libs as in json-url
      const packed = JSON.stringify(obj)
      const compressed = await lzmaCodec.compress(packed)
      //const encoded = (await import(/* webpackChunkName: "'urlsafe-base64" */ 'urlsafe-base64')).encode(compressed);
      const encoded = encode$1(compressed)
      return encoded
    },
    decoder: async (msg /*,_options?:any*/) => {
      // const lzmaLib = await import(
      //   /* webpackChunkName: "lzma" */ 'lzma/src/lzma_worker'
      // )
      // // this special condition is present because the web minified version has a slightly different export
      // const lzmaCodec = lzmaLib?.compress ? lzmaLib : lzmaLib.LZMA
      const lzmaCodec = await Promise.resolve()
        .then(function () {
          return lzma$1
        })
        .then((d) => d.default())
      // we use exact algorithm and libs as in json-url
      const decoded = decode(msg)
      const decompressed = await lzmaCodec.decompress(decoded)
      const unpacked = JSON.parse(decompressed)
      return unpacked
    }
  }

  const handler$4 = {
    name: 'JSON-URL LZW',
    encoder: async (obj /*,_options?:any*/) => {
      const jsonUrl = await Promise.resolve()
        .then(function () {
          return jsonUrl$1
        })
        .then((d) => d.default())
      const lzwCodec = jsonUrl('lzw')
      return lzwCodec.compress(obj)
    },
    decoder: async (msg /*,_options?:any*/) => {
      const jsonUrl = await Promise.resolve()
        .then(function () {
          return jsonUrl$1
        })
        .then((d) => d.default())
      const lzwCodec = jsonUrl('lzw')
      return lzwCodec.decompress(msg)
    }
  }

  const handler$3 = {
    name: 'URL Safe Base64',
    encoder: (obj /*,_options?:any*/) => {
      // const safeJSONStringify = require('json-stringify-safe')
      // const URLSafeBase64 = require('urlsafe-base64')
      return Promise.resolve(
        encode$1(Buffer.from(safeJSONStringify(obj), 'utf-8'))
      )
    },
    decoder: (msg /*,_options?:any*/) => {
      const URLSafeBase64 = require('urlsafe-base64')
      return Promise.resolve(
        JSON.parse(
          Buffer.from(URLSafeBase64.decode(msg), 'utf-8').toString('utf-8')
        )
      )
    }
  }

  //import { baseEncodings } from '.'
  const msgEncodings = {
    gzip: handler$6,
    'json-url-lzma': handler$5,
    'json-url-lzw': handler$4,
    base64url: handler$3
  }
  /**
   * Map of encoders and their message headers. Headers are used to auto-detect which decoder needs to be used to decode the message
   *
   * Sorted from worst to best compression for average message bodies
   */
  const EncodingByHeaders = {
    '0-': 'base64url',
    XQ: 'json-url-lzma',
    wo: 'json-url-lzw',
    '1-': 'gzip' //gc wallet v2
  }
  /**
   * Map of message headers and their encoders.
   */
  const HeadersByEncoders = Object.fromEntries(
    Object.entries(EncodingByHeaders).map(([header, encoding]) => [
      encoding,
      header
    ])
  )
  /**
   * Async loaders for the required encoding handlers, as a map.
   */
  Object.fromEntries(
    Object.keys(HeadersByEncoders).map((encoder) => {
      const loader = () =>
        import(`./${encoder}`).then((module) => module?.default)
      return [encoder, loader]
    })
  )
  const handler$2 = {
    name: 'Packed GCScript or data message with header',
    encoder: async (obj, options) => {
      const useEncoding =
        options?.encoding || DefaultAPIEncodings[DefaultAPIVersion] // use an specific encoder or use the default one
      // const handlerLoader = EncodingHandlers[useEncoding]
      // if (!handlerLoader) throw new Error('Unknown encoder. Cannot encode')
      const codec = msgEncodings[useEncoding] //await handlerLoader()
      if (!codec) throw new Error('Unknown encoder. Cannot encode')
      const header = HeadersByEncoders[useEncoding]
      if (!header) throw new Error('Unknown encoder header. Cannot encode')
      const msgBody = await codec.encoder(obj, options?.encodingOptions)
      const msg = `${['XQ', 'wo'].includes(header) ? '' : header}${msgBody}` //legacy modes has no added header
      return msg
    },
    decoder: async (msg, options) => {
      if (!msg) throw new Error('Empty data. Cannot decode')
      let detectedEnconding = undefined
      let useHeader = ''
      Object.keys(EncodingByHeaders).forEach((header) => {
        if (!detectedEnconding && msg.startsWith(header)) {
          detectedEnconding = EncodingByHeaders[header]
          useHeader = header
        }
      })
      if (!detectedEnconding)
        throw new Error('Unknown decoder header. Cannot decode')
      if (options?.encoding && detectedEnconding !== options?.encoding)
        throw new Error('Unexpected encoding detected. Cannot decode')
      // const handlerLoader = EncodingHandlers[detectedEnconding]
      // if (!handlerLoader) throw new Error('Unknown decoder. Cannot decode')
      const codec = msgEncodings[detectedEnconding] //await handlerLoader()
      if (!codec) throw new Error('Unknown decoder. Cannot decode')
      const useMsg = !['XQ', 'wo'].includes(useHeader) //legacy modes has no header actually
        ? msg.replace(useHeader, '')
        : msg
      const obj = await codec.decoder(useMsg, options?.encodingOptions)
      return obj
    }
  }

  const encoder = async (obj, options) => {
    //const template = require('string-placeholder');
    //const template = await import('string-placeholder').then((d) => d.exports)
    const useUrlPattern = options?.urlPattern || ''
    const useMsgPlaceholder = options?.msgPlaceholder || 'gcscript'
    if (!useUrlPattern) throw new Error('Missing URL pattern')
    if (!useMsgPlaceholder)
      throw new Error('Missing message placeholder for URL pattern')
    //console.log({ message })
    const msg = await handler$2.encoder(obj, {
      encoding: options?.encoding,
      encodingOptions: options?.encodingOptions
    })
    //console.log({ msg })
    const parsedUrl = new URL(useUrlPattern)
    if (!parsedUrl || !parsedUrl.origin || !parsedUrl.host)
      throw new Error('Invalid URL pattern provided')
    const templateContext = {
      [useMsgPlaceholder]: msg
      //date:moment().toISOString(),
    }
    //naive templating, risking an origin override attack (*)
    const solvedURL = template$1(useUrlPattern, templateContext, {
      before: '{',
      after: '}'
    })
    const parsedSolvedURL = new URL(solvedURL)
    if (!parsedSolvedURL)
      //if dont pass URL validation check
      throw new Error(
        'Failed to construct a valid URL with provided pattern and message'
      )
    if (!solvedURL.startsWith(parsedSolvedURL.origin))
      //(*) check if origin was overrided by a templating attack
      throw new Error(
        'Illegal template provided. URL origin cannot be replaced.'
      )
    const wasTemplateUsed = useUrlPattern !== solvedURL
    if (!wasTemplateUsed)
      throw new Error(
        'Message was not embedded on URL. Invalid template or message placeholder provided'
      )
    return parsedSolvedURL.toString() //finally we construct the URL from the parsed version to ensure it's valid
  }
  const decoder = async (msg, options) => {
    //const template = await import('string-placeholder').then((d) => d.exports)
    const useUrlPattern = options?.urlPattern || ''
    const useMsgPlaceholder = options?.msgPlaceholder || 'result'
    if (!msg) throw new Error('Missing message')
    if (!useUrlPattern) throw new Error('Missing URL pattern')
    if (!useMsgPlaceholder)
      throw new Error('Missing message placeholder for URL pattern')
    const dummySeparator = '>@<'
    const dummyContext = { [useMsgPlaceholder]: dummySeparator } //Dummy context with a temp separator. Will replace the message placeholders for the separator
    const layout = template$1(useUrlPattern, dummyContext, {
      before: '{',
      after: '}'
    })
    const extraParts = layout
      .split(encodeURI(dummySeparator))
      .filter((x) => !!x.trim()) //remove empty strings (and whitespace but makes no sense)
    let tempMsg = `${msg}`
    extraParts.forEach((extraPart) => {
      tempMsg = tempMsg.replace(extraPart, dummySeparator)
    })
    const foundMessages = extraParts
      .split(dummySeparator)
      .filter((x) => !!x.trim()) //remove empty strings (and whitespace but makes no sense)
    if (foundMessages.length <= 0)
      throw new Error(
        'Not messages found with the provided URL pattern and message placeholder'
      )
    if (foundMessages.length > 1)
      throw new Error(
        'More than one message found with the provided URL pattern and message placeholder'
      )
    const useMsg = foundMessages[0]
    if (!useMsg)
      throw new Error(
        'Empty message found with the provided URL pattern and message placeholder'
      )
    const obj = await handler$2.decoder(useMsg, {
      encoding: options?.encoding,
      encodingOptions: options?.encodingOptions
    })
    return obj
  }
  const handler$1 = {
    name: 'GameChanger Wallet URL transport. Used as dapp connector to send and receive messages through URLs',
    encoder,
    decoder
  }

  var URLEncoder = async (args) => {
    try {
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const url = await handler$1.encoder(obj, {
        urlPattern,
        encoding
      })
      return url
    } catch (err) {
      if (err instanceof Error)
        throw new Error('URL generation failed. ' + err?.message)
      else throw new Error('URL generation failed. ' + 'Unknown error')
    }
  }

  var browser = {}

  /**
   * Font RegExp helpers.
   */

  const weights = 'bold|bolder|lighter|[1-9]00'
  const styles = 'italic|oblique'
  const variants = 'small-caps'
  const stretches =
    'ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded'
  const units = 'px|pt|pc|in|cm|mm|%|em|ex|ch|rem|q'
  const string = '\'([^\']+)\'|"([^"]+)"|[\\w\\s-]+'

  // [ [ <‘font-style’> || <font-variant-css21> || <‘font-weight’> || <‘font-stretch’> ]?
  //    <‘font-size’> [ / <‘line-height’> ]? <‘font-family’> ]
  // https://drafts.csswg.org/css-fonts-3/#font-prop
  const weightRe = new RegExp(`(${weights}) +`, 'i')
  const styleRe = new RegExp(`(${styles}) +`, 'i')
  const variantRe = new RegExp(`(${variants}) +`, 'i')
  const stretchRe = new RegExp(`(${stretches}) +`, 'i')
  const sizeFamilyRe = new RegExp(
    `([\\d\\.]+)(${units}) *((?:${string})( *, *(?:${string}))*)`
  )

  /**
   * Cache font parsing.
   */

  const cache = {}

  const defaultHeight = 16 // pt, common browser default

  /**
   * Parse font `str`.
   *
   * @param {String} str
   * @return {Object} Parsed font. `size` is in device units. `unit` is the unit
   *   appearing in the input string.
   * @api private
   */

  var parseFont$1 = (str) => {
    // Cached
    if (cache[str]) return cache[str]

    // Try for required properties first.
    const sizeFamily = sizeFamilyRe.exec(str)
    if (!sizeFamily) return // invalid

    // Default values and required properties
    const font = {
      weight: 'normal',
      style: 'normal',
      stretch: 'normal',
      variant: 'normal',
      size: parseFloat(sizeFamily[1]),
      unit: sizeFamily[2],
      family: sizeFamily[3].replace(/["']/g, '').replace(/ *, */g, ',')
    }

    // Optional, unordered properties.
    let weight, style, variant, stretch
    // Stop search at `sizeFamily.index`
    const substr = str.substring(0, sizeFamily.index)
    if ((weight = weightRe.exec(substr))) font.weight = weight[1]
    if ((style = styleRe.exec(substr))) font.style = style[1]
    if ((variant = variantRe.exec(substr))) font.variant = variant[1]
    if ((stretch = stretchRe.exec(substr))) font.stretch = stretch[1]

    // Convert to device units. (`font.unit` is the original unit)
    // TODO: ch, ex
    switch (font.unit) {
      case 'pt':
        font.size /= 0.75
        break
      case 'pc':
        font.size *= 16
        break
      case 'in':
        font.size *= 96
        break
      case 'cm':
        font.size *= 96.0 / 2.54
        break
      case 'mm':
        font.size *= 96.0 / 25.4
        break
      case '%':
        // TODO disabled because existing unit tests assume 100
        // font.size *= defaultHeight / 100 / 0.75
        break
      case 'em':
      case 'rem':
        font.size *= defaultHeight / 0.75
        break
      case 'q':
        font.size *= 96 / 25.4 / 4
        break
    }

    return (cache[str] = font)
  }

  /* globals document, ImageData */

  const parseFont = parseFont$1

  browser.parseFont = parseFont

  browser.createCanvas = function (width, height) {
    return Object.assign(document.createElement('canvas'), {
      width: width,
      height: height
    })
  }

  browser.createImageData = function (array, width, height) {
    // Browser implementation of ImageData looks at the number of arguments passed
    switch (arguments.length) {
      case 0:
        return new ImageData()
      case 1:
        return new ImageData(array)
      case 2:
        return new ImageData(array, width)
      default:
        return new ImageData(array, width, height)
    }
  }

  browser.loadImage = function (src, options) {
    return new Promise(function (resolve, reject) {
      const image = Object.assign(document.createElement('img'), options)

      function cleanup() {
        image.onload = null
        image.onerror = null
      }

      image.onload = function () {
        cleanup()
        resolve(image)
      }
      image.onerror = function () {
        cleanup()
        reject(new Error('Failed to load the image "' + src + '"'))
      }

      image.src = src
    })
  }

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i]
      if (last === '.') {
        parts.splice(i, 1)
      } else if (last === '..') {
        parts.splice(i, 1)
        up++
      } else if (up) {
        parts.splice(i, 1)
        up--
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..')
      }
    }

    return parts
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
  var splitPath = function (filename) {
    return splitPathRe.exec(filename).slice(1)
  }

  // path.resolve([from ...], to)
  // posix version
  function resolve() {
    var resolvedPath = '',
      resolvedAbsolute = false

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = i >= 0 ? arguments[i] : '/'

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings')
      } else if (!path) {
        continue
      }

      resolvedPath = path + '/' + resolvedPath
      resolvedAbsolute = path.charAt(0) === '/'
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(
      filter(resolvedPath.split('/'), function (p) {
        return !!p
      }),
      !resolvedAbsolute
    ).join('/')

    return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
  }
  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isPathAbsolute = isAbsolute(path),
      trailingSlash = substr(path, -1) === '/'

    // Normalize the path
    path = normalizeArray(
      filter(path.split('/'), function (p) {
        return !!p
      }),
      !isPathAbsolute
    ).join('/')

    if (!path && !isPathAbsolute) {
      path = '.'
    }
    if (path && trailingSlash) {
      path += '/'
    }

    return (isPathAbsolute ? '/' : '') + path
  }
  // posix version
  function isAbsolute(path) {
    return path.charAt(0) === '/'
  }

  // posix version
  function join() {
    var paths = Array.prototype.slice.call(arguments, 0)
    return normalize(
      filter(paths, function (p, index) {
        if (typeof p !== 'string') {
          throw new TypeError('Arguments to path.join must be strings')
        }
        return p
      }).join('/')
    )
  }

  // path.relative(from, to)
  // posix version
  function relative(from, to) {
    from = resolve(from).substr(1)
    to = resolve(to).substr(1)

    function trim(arr) {
      var start = 0
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break
      }

      var end = arr.length - 1
      for (; end >= 0; end--) {
        if (arr[end] !== '') break
      }

      if (start > end) return []
      return arr.slice(start, end - start + 1)
    }

    var fromParts = trim(from.split('/'))
    var toParts = trim(to.split('/'))

    var length = Math.min(fromParts.length, toParts.length)
    var samePartsLength = length
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i
        break
      }
    }

    var outputParts = []
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..')
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength))

    return outputParts.join('/')
  }

  var sep = '/'
  var delimiter = ':'

  function dirname(path) {
    var result = splitPath(path),
      root = result[0],
      dir = result[1]

    if (!root && !dir) {
      // No dirname whatsoever
      return '.'
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1)
    }

    return root + dir
  }

  function basename(path, ext) {
    var f = splitPath(path)[2]
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length)
    }
    return f
  }

  function extname(path) {
    return splitPath(path)[3]
  }
  var path = {
    extname: extname,
    basename: basename,
    dirname: dirname,
    sep: sep,
    delimiter: delimiter,
    relative: relative,
    join: join,
    isAbsolute: isAbsolute,
    normalize: normalize,
    resolve: resolve
  }
  function filter(xs, f) {
    if (xs.filter) return xs.filter(f)
    var res = []
    for (var i = 0; i < xs.length; i++) {
      if (f(xs[i], i, xs)) res.push(xs[i])
    }
    return res
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr =
    'ab'.substr(-1) === 'b'
      ? function (str, start, len) {
          return str.substr(start, len)
        }
      : function (str, start, len) {
          if (start < 0) start = str.length + start
          return str.substr(start, len)
        }
  var qrLibLoader = async () => {
    const isNode = typeof process === 'object' && typeof window !== 'object'
    //const useGlobal = isNode ? global : window;
    /**
     * Trick:
     * by using this dynamic argument on `import(pathStr)`
     * I prevent rollup/typescript to detect and auto-process the imported js files
     */
    const pathStr = isNode
      ? 'easyqrcodejs-nodejs'
      : '../../dist/easy.qrcode.min.js'
    //: 'https://cdn.jsdelivr.net/npm/easyqrcodejs@4.6.0/dist/easy.qrcode.min.js' //'json-url/dist/browser/json-url-single.js'
    if (isNode) {
      const _QRCode = await import(pathStr).then((d) => d?.default) //QRCode4Node //require('easyqrcodejs-nodejs')
      //const path = require('path')
      const QRCode = _QRCode //replaceable by a wrapper class
      const createQRCode = (options) => {
        // const canvas = require('canvas').createCanvas(options.width, options.height) //https://github.com/Automattic/node-canvas
        return new QRCode(options)
      }
      const renderQRCode = async (args) => {
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
      const registerFonts = (items) => {
        const { registerFont } = browser
        items.forEach(({ file, def }) => {
          const fontPath = path.resolve(__dirname, file)
          // console.log(
          //   `Registering font '${fontPath}' (${
          //     def?.family || 'Unknown'
          //   }) on NodeJS Canvas...`
          // )
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
        Canvas: browser,
        createQRCode,
        renderQRCode,
        registerFonts
      }
      // return {
      //   _QRCode: {},
      //   QRCode: {},
      //   Canvas: {},
      //   createQRCode: () => {},
      //   renderQRCode: () => {},
      //   registerFonts: () => {}
      // }
    } else {
      //const _QRCode = await import('easyqrcodejs/dist/easy.qrcode.min.js').then(() => {
      //const _QRCode = await import('easyqrcodejs/src/easy.qrcode').then(() => {
      //WORKS but nodejs version breaks it on browser?
      //const _QRCode = await import('easyqrcodejs').then(() => {
      const _QRCode = await import(pathStr).then(() => {
        return window?.QRCode
      })
      const QRCode = _QRCode //replaceable by a wrapper class
      const createQRCode = (options) => {
        const canvas = document.createElement('canvas')
        if (!canvas) throw new Error('canvas creation failed on browser')
        return new QRCode(canvas, options)
      }
      const renderQRCode = async (args) => {
        return new Promise(async (resolve) => {
          const qr = createQRCode({
            ...(args.style || {}),
            text: args.text,
            onRenderingEnd: (qrCodeOptions, dataURL) => {
              //console.dir({ dataURL, qrCodeOptions })
              resolve({ qr, qrCodeOptions, dataURL, SVGText: '' })
            }
          })
        })
      }
      //TODO: fix paths on browser by bundling the files. Maybe as a blob or dataURI?
      const registerFonts = (items) => {
        const { registerFont } = browser
        items.forEach(({ file, def }) => {
          const fontPath = file
          // console.log(
          //   `Registering font '${fontPath}' (${
          //     def?.family || 'Unknown'
          //   }) on Browser Canvas...`
          // )
          try {
            registerFont(fontPath, def)
          } catch (err) {
            // throw new Error(
            //   `Error registering font '${fontPath}' (${
            //     def?.family || 'Unknown'
            //   }) on Browser Canvas. ${err}`
            // )
          }
        })
      }
      return {
        _QRCode,
        QRCode,
        Canvas: browser,
        createQRCode,
        renderQRCode,
        registerFonts
      }
      // return {
      //   _QRCode: {},
      //   QRCode: {},
      //   Canvas: {},
      //   createQRCode: () => {},
      //   renderQRCode: () => {},
      //   registerFonts: () => {}
      // }
    }
  }
  //Example wrapper for future reference
  // class QRCode extends _QRCode {
  //   private _htOption!: ObjectType
  //   constructor(options: ObjectType) {
  //     //const { width, height } = options
  //     // const canvas = Canvas.createCanvas(width, height)
  //     // if (!canvas) throw new Error('canvas creation failed on nodejs')
  //     super(options)
  //   }
  //   changeStyles(styles: ObjectType) {
  //     this._htOption = {
  //       ...(this._htOption || {}),
  //       ...styles
  //     }
  //   }
  // }

  const handler = {
    name: 'GameChanger Wallet QR transport. The URL transport encoded as QR code',
    encoder: async (obj, options) => {
      const { renderQRCode } = await qrLibLoader() //If turns into async, must be moved inside
      const url = await handler$1.encoder(obj, options)
      const qrResult = await renderQRCode({
        text: url,
        style: { ...(options?.qrCodeStyle || {}) }
      })
      const qrResultType = options?.qrResultType || 'png'
      const handlers = {
        png: async () => qrResult?.dataURL,
        svg: async () =>
          `data:image/svg+xml;base64,${Buffer$1.from(
            qrResult?.SVGText /*await qr.toSVGText()*/
          ).toString('base64')}`
      }
      const res = await handlers[qrResultType]()
      //console.log({ qrResult, qrResultType, res })
      return res
    },
    decoder: async (/*msg: string ,_options?:any*/) => {
      throw new Error('Not implemented yet')
    }
  }

  var logoURL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAa0AAAB1CAYAAAD9TL7BAAAe3UlEQVR4nO2dC5hU1ZXvf9V00zTNo5tHgyCvRhBR8AWIIoqAohM0DibxkagzmoeJJmYy95tMzBijGXW8j0n0mu86cydqTIwab27MVaNRxzdGRQQib1CR97u7gaZ5NF33W6vOOZzqelefqq7TrJ8fdtWpfc7ZZ5+q/T9r7bXXjswmGgWIkB3ZlCtmmSDPl025UmynbMqVYlsGeayw1snasvjHst9wuPv7sizLGYZhGEanY6JlGIZhhAYTLcMoEFFrWMMIHBMtwygQ2froDcPIHhMtwygQZmkZRvCYaBlGgTBLyzCCx0TLMAqEWVqGETwmWoZRIMzSMozgMdEyjAJhlpZhBI+JlmEUCLO0DCN4TLQMwzCM0GCiZRiGYYQGEy3DMAwjNJhoGYZhGKHBRMswDMMIDSZahmEYRmgw0TIMwzBCg4mWYRiGERpMtAzDMIzQUG63KndeoDdRokToFpo655OdoY1WTuNBRvK3acut4xEWcYu2R6QL54GI0qb/n80b9OPMtGU/4Nt8zMNE7CembRblCOfxS0bxhbQll3I/H3Bb0nbrSt8s+W2VUc5XaSqB2oQL+0XlQSv7QlfnfGllb8Y9pcwR9pfqJQROGwczHvIAO2k9htokG1ppzljqME3WbkZazD1opKWMyowNlE2ZrkQ21lM51fbFakcZ3TOW6UaPItfKCBsmWoZhGEZoMNEyMmALbBiGUTqYaBlpyWZMyzAMo1hYIEaAjODr9OYUorRmddBsoqGCipjK5zhHaGYQc/I+p4xhnMQ/UUEfJ/IumHp15DjZlJOoriaWs4aHOlirRKoZzkl8z4moiwYaERdxxtt28Gc+5Ykkn5cxkX+iB/1p40ja42R7vvj33WhhO0u4O8eaZ0a+Q6fxA8qpSvldyrX+mSjkcSSaMkzRx6WEiVaAjORm+jBRDxiUIAXVGQfZqWdLGRWM5/ai1CvI65Mye1hZINEayThuzak+2ZZzy/RlbFLRkhKncWdB21IEZQn3BO5WrqSG0/jHvOuVy+fZHifIMkb2mHswQA6wqctcSxCIJXGQ7aGs+342FuS4RzhQkOP6aWFrys+a2VDQc+/j04IcV+Y1HTZX9TEPJlqGYRhGmDDRMgwjJJijzTDRMgwjBEhwTAW97FYZFohRKjSzhvU8psEL+VCISCdJVzSEedRmyLNnGIXmIA0s4IdUUK3jW9l+hztCYaMH2zSacxI/KkLrdS1MtEqERhaxmn8uuXpVUGOiZXQ6EoSxWKMSuxYmWrlj7sESoRs9S7Je5fTJe9+IZiWsC7Q+xaInw0JZb8Po6pilZRSMNg6xhgeooG/KeTul5spBn+TKaGRpgEc0DCMoTLSMgiGitdg3kdYwDKOjmHuwRMhmjSbDMIxjHbO0SgQJeKhimI4DFROJVpQsDQfYnDGnm2F0FpKnr5qh+n3NFD2YiVKY7RXLO2nzzvLBRKtEGMAFzGZNwk+q0Ln5JKltCxt5hZM5zJ6QtJZxrFHFIOaxiEpqaeNw2qu33INdGxOtEkEsrEiSFYCLkVC2glr7aRklTUR/Hf20iplWQDbR6tqYaBkcYV/BFnuMdTCRUC0mKQ8QsnREpid6o3iIO03malXQ21r9GMdEyygY3ahiJu9QyQDtdJJRmkuTlLGDN5nPNVke1TCMYmGiFSDlIc2NVq7zqIJ3Ykjn35eJaYNLSnU9rd6MyfKIRjGIaAiGWVmGiVagHGQHrepqC9cikLLmVSEiB8W6OsTOUGbFOERjCdTCcBF37X62ZCVcYRjTiuUejJgQ54GJVoAs4lpd7rwUSffjEnFxxdYwSpEWtvFbTuwyYeKxh8QIX7OI3Zwx0QoQeRY0DCN4ohoWYysXG5YRwzAMwwgRJlqGYRhGaDDRMjKQzfyqVGXCnBaqo/PKOq9NUk0vKF6arlTXnrlNU9XdMFxMtIy0tGYxUJwq/ZPkNJSorzDSSkvKWst1ZeIAO5KW2M/mgrdG6qCaWMhNIUk3IftwFsE+FrVpZMICMfJgnK6gGtUknqkIw5LfmThCM3VclLHcIC7SIBSZTOwiSU3LqXLW0goftUxkInfp7CC39WKWSjSrOVxj+Sb9OJ1y3+KeIna9qC94WwxmBqfxY12C0422k/sh2UlkonchqWIwk7lPxUsiaSOOVMoyNYOZnvHMI7hc27yc6oTPSnHttXxD3ts4Qlma/sNI056ziUazbfxsy5XaHKUgj1WqectKrd7FPlZY62RtWfxj2W843P29uQcNwzCM0GCiZRiGYYQGG9PKg/lMc3Yq/Oz8VGeQcYKhXMlovhO3/QBb+YBrOOKshDyQmYznJwWvZ+zcW3iXL3lRaoOYzcncGVdGxr7e5SoOsqtTshu4Z5T268eZnMkDCWXe4cvsY11R6pfu/vZiJOfyeMJn7/MddrGwk7NDROlBf2bwZNy4nfAhd7CZVzqtfu44Wjcqmclv6MnguM+X8gBreapo9UuexikWJTmP+UWpQ1fCRCsPdvNOSdSjmhMStknwxA5e897HAgmKQyvN7ORt71z+wAwXGaDfzLNFq1M6DtGQ9NNNPFcSC2I2sjTp9i28QhMril6fZCSLFtzOfLaXyG9EvpPt2cFCtpVI/YzcMfdgiOmWdNHIcrrRw3tfzGS1sWixo1+pSgYmKVNGj3ZPvp1FVYp6VDG0JOrXM0U9UtW72Eg0YjJrpUeS+955JNbPXUzSCCdmaXWQbvSkgpqCTdxM5z6qLJHOqyP4w7ALOfk1trBjKwfZmdN5RIilfrH929p9FiRlarcc0PplP5cqooHtAyijvIiTh3Hcg3VZPfeKiInF39H65dLeMfdgD7plWOU4Vr/++gBY6PaTe3WQRlotR2mHMNHqIMdzHRP4eUJHU4ww0HTzxMJCP6ZwAW843UzqicgdDQcW8TlME88zRsfTskXmZP0VS7StC3GPI97fcr3+5zg1J9dfd2q5nJXOfLjsxC640OpIFu7nCHN5mz6ckFaMCxWmnY17fA5/YBBnF/w3LPf4TW5mGQ9lsZeRChOtDiJPc/LTjbR7oiv23IVCHiH7M+V+rjKfS7Ejk7WzObN08Lm2h0wAdTu+QtzjSNzrsjweRCLOdSXWL4g6BVFOLJlkv5Fczxl0vVwqqSnab7jc57o38sPGtDqIzPQvZZJlFigUPRme85GLmeYpNiifW267jriM8nlcyP180aTBBqWEK6qlyuEitt+REu8vwoBZWl2c3bzHau51oryC8dkn64xlZOUg2/JIeFpMS/DYfEaT9FHL+VcnZ2JZQC3eRnf6Mp5v67hkOt7je1QxyJuGkYygUyuJ+Ms41cncTHdqMpQv5veiayxi2ZmYaHVx9rKcZdxWsheZqcMLklgI/rEnXDLw/yE/LMixx/JVuqe9h1GWcX9Bzp0No7kqo2j1KHA+Rj8VRfR8dFVMtIxOpZHF/FknJKe30IIY24tyWIMxjjUiOjJXmdbSyQcJvS9l61XGB7MZI3yDG6mkf17L0eTyvZS2kjliRscw0TI6FQlB38DTdhMKSjRwwQoDctXZjBFu4tVjrm3CjIlWF2cA5zOOH2X9FJl/xFRE0zi9z7UBLKBoBEkFvZnDazqmJZGQ+UcPRniP79LARznULsIMfkUVx6X9XgQ/phVbiqWaIQEe2SgFTLS6ONXUa/7B4ixFEGUB1+UUjCEukzLN7BEt8OTibvrkXerRnoVA5gfJGlsuHQl5F5dgbqIF9VyV0U3XmSHvIuQicOkWsMzteOW6flmy75q0g6wzZ1GE+WOi1UHK6V3S9Uu9im3wNPNZzsesZRLn8owKVjrRCmJysazC/DJnp8w5GEYi2kUWc3A/dytaHhZKeSL8RfyOQUyltd2K1PkKqYjgPtbzO85K+OxMbmMKd3GAXSU/VaFUMdHqIPtYTQPvEc3jyakjT5dtHKQn9WpJhZlyetFDXUcda6vsnq6PU/HqSsjT/GZecoQrO0s1v7aM6H8tbM+59T7jGaoZptZHvnXKtoxbLrYycAUDOTMuF2cyahiXNF9iR+pURR0DOJ39bGU/W7ztLeyggeXUMh40+MPIFROtDrKV3+u/zmAk3+C0kKeEiQbkksmG2JNtMfPzFZ5DNPEKc0q4hlFe5cpOO/vVfEJvRqUtc7AAlrdYwF/kQ9bzR57nc952SeEk/y7jZY5nduDnPRawjBghpizFM0fuE3yDI7tzR32vilvXaFbn7rz6xbvfMtevcwlDwE3nTuYVK24MV9GfCXHbV/M4q/l1p9UrzJhohZhkc46iOgB8NLxZFoUsFrGEo0c7MsmQkVg/yWR+dHsLm4t4A8SZttt7d8DntvGznw3eO//rYtDsO19zinPvT1HvYtOiGVASLdeWJPe9s0iWJkwy6fsp5HSAPtRzIU9wCt+K276SR3lFI22NXDH3YB7U8z3dqaMTKzvyDNhGC3VclLC9O/0Yyw9UGiQaqpYpHapjLnSnPyfyD3pekYcBnJ2wt4wvnMxdHGKXdih9OKlo9ZMoxVO4Q8VeBLYvJyctN4Efe2LVk2FFq59wKnd4YlWd4tzj+S6NLMs4VpOKIGwPucexJT0S6zCWG6lhvEbJBUluS5Mc0bolWzurni9qCqpuTtRqb0YGWs9kyPjWBG7x2qu4y8h0LSKzieqjcXFCooMvE+T5silXiu2UTblSbMsgjxXWOllbFv9Y9hsOd39v7kHDMAwjNJhoGYZhGKHBRMswDMMIDSZahmEYRmgw0TIMwzBCg4W8GznTyIfsZY0G7g7gXKo43hrR8NjBe+xjnaZSGsosXbXYMILCRMvImYXcRAMLdLcZvGWiZcTxOlezl0910xWsMNEyAsXcg0ZORDUXdiyLRSV11HKmNaDhIfkd3YwYfThB0xgZRpCYaBk50cwntLBJd+nNOLoFnPXACDctbKWV/XoNgznf7qYROOYeNJKyi/ls4vfsY42mq+rDKYzlv3CIRq94X05Juu82XmIX79DCRrXGjuMSBjCd/XxGA4u0zGDmqODt4j3NAVjFEPoxhWbWsZUXaeIjXUakltMZwqVUtlvGQdIsNbBQXw/lcv0ry/bL8aTT7MUoBnMxNe0SlWZLI39hG6/RxApNR9SfKRzHxXSnNuURWjUr4Etah4Ps0jRMg5nFQM5JKCvH3cMqutNbyzSxks/4Lc2s1/2GMpf+7azYPaymieWU0YOhXMxe1rKOp9QV15MhDONzDEiyhtPR+u1jEy+xk3f1PkobDWEWAzKk+pJr2cwrOlYl19iXExnChfRrd/93sYg1POq9P8we3a8fp9GDAb56NLOJl9nOuxxkN70YwVBmUpck7VcDy9jDGnpQp2tereTf9XoncXfKhNFG18bSOOVYrqungDnIVhZzC5v4XcJnvTiBXoxlK3/U92fwEPV8w/t8C8+xjNtpZHHCvqfzoArZen6j7+fRonnY/h+DOMh2ajmDIVzGCu5OWEFWhO8cnqLOt/ruIm5lNQ/o64ncw3qeVKFpz8nczgTuyrodRAj+wm2s5+mEzyoZyBn8D0Y5iU79x1rDQyzlbvazMWG/4VzBNH4dl6fvFWaxlVd1xdx6rmUtv0jYbzI/Yxy3eud6lcvYyLP6/gRuYC0PJ+xzBvcygX9M2L6CB1jKfexPkqB4NF/hXB71Fmr0X9cS/pnl3J+QZBbNMXgD0/jf+lAjYvZYisUov8Aq+jJWXy/nQZbwL+x3rHU/9XyJ8/llXDs9x/ls5U0q6KP5+7bwBj0ZzJf1OlKt/JUeS+MU8v7eRCu3cl35C9/Mp7zO2XHZ2asZpSLSkqQznsGbakEJq7iPj9p1lrElzI8ujimdmyQKlX0u4E21sJ5laJZLXES4lHX0ZLi+e4OL2MrLao1FfYsLtn+Pdv7/xmi+nrEdtvEqbzCXI7T4rqEiQUSn8zuGMc871nyuYR1PpK19HedyEW9573/PCLWq/CQ711/zKb0Yqef6A+PVQsu0z+WsVGvI5Q2+xDqfCLuJnv1JW4dzOTOddeEiTsLZl7iEzbwct1/7RK/HcwkX8Ud2s5hnOD3humUxxGuc79NrXMUnPJW2nQYznbm86dTvCE8ykuZ2373x3Mw0Hkx5DBOtYMoEeSzLPWgEjnQQb3OhJ1h1zOZ8lYZVzGEVk9tZCiJIfRz30EaejhOs0XyLWSzgYlZyHn+iLxN1u9vh1TjvY5bRUcGSLPFn8CCXsIKLWc4E7vFdZpTl3O293sNK51VMoMbybeawkM+ximk8TU9fRONizTyffmXpvazmVWZ5gjWaG5nDe8xlJRfwItW+TOBvcYVX73e5wROsKo5jCv+LS1nJXJZxMv/g7bOdt1nHk/q6mc/iLLJaJjKbl/i81v1Xce0srjycsaJ9fOJt78OJzOKPXM4qzuOpuCX3t/vE8S2+4gmWuOnO4wnmsZq/ZhXn8ojn7lzPM+zgz95+r3CZJ1g1nMz5PM48VnI5f+EkbvbKbeQF/Seuxuk8THdqdHsltUznUWbzB33/Btd7giWuzGk8xBdYyRUsYwJ/7x1vK2+xjv/r3JN1cYIlq/3O4DHO4Pa099Lo2phT2FBWcS/NfKyvj2Mu5zhuqBgVDOfLHGIHS/g73SJuQunwRAwWcL1XcjKPMcLnPhNLbSbTeJ5hHHJWiHVFTMatXKoYyoUsiFt6X5YtaWUvK7hX38tYETqetTFunauz+Q0juNp734t63fdFTlUxlqVImnSJ89NS3uz5XOW9nsQDKoL+483kJRZyqy4ZH1ttOcIO3uFjHtEy1QznEj5QF6LL6dyn40Gu60/GrEZylY5fuQIuQvdXLNCHgNi5RvEpv9Il9P2IheWu+1TJAOay0BOq2D5PsIFn4vbZwLN8wuP6up4vM91ZdNB9ou2j7t6RvMgF+l7EZyBns5ZfstFxAQ9kKp9jftwyPFN5UBfHbNIHhzYVFlnqYzTXMp+btIwI5Biu13Ot5znW8phul1WEL+P9uDGuKfx3bafVznjYJ9pO85zju3UdzTwWq2VpHNuYaOVBe/dTOOoc1Y7HHbfwI4tGruV+3SId4WR+lfQYg5nriVZfJ8DhMx7zrJMRXOcJlh85Zh0z2eiMk/Vx1rFq8o1BTebhOMFyGcnfeKLltntsYnOMkVzLcJ9guchaWRLEsZsPdIuIXyq28Z++AJEL4wTLpTdjmOF05C4LnbYQzuHXcYLlMpZveqLlLn4pVp3/c1ewXPzvJUAFtUqXetvGcGOcZYWuU3Z0nz6Oa3AJP/a2yb1fwk/0wSHibSvncJJ2Wcyd+lcCHS7gt0nXjTubnye4c0QkXYu2ry/U/UPu8F5fwJNxguUyjq97ouWOdzX6XKGn8L2UgiUPALHFHiPOdaWndFxjURPhPDDRyoOXnI6koxR7IfD+nMtUx/Xip4EPOOQMtA9kFhWOi6c9srCkSw2n6qtNvuONbrc6qx932XqJGKxxLJ49LNe/vRjN4CQLWranu7Ognxs1iAYkpD5nxPf1rtKxs+Rs8AWd1HNDxnrgRC/u4n19LQJZ54ztpbpuHPEWdjsCKQzivIR99jkTc8vU2TZeXzf4rNJBvoCUo/us814P5CwVo1186G37OMWDiJ/ejFbRcScGS91SLUSZjN2+h5B+zvdjL5949ahlAgOzWJTUdVnu9l1z/zRW8qc8zfwkDxodpRi/z79lexHO0rUw0coDcZOFkT2+TsCP6xbEcVelQkLRXWo4Q1/t93WWPRmRct+dzjiLRCBK592mAdGxJ2lxIaY+5wve6/5M1b+u9USalYUPsNUTNwneEBdfKvbFXUNqcfPT5AgujnsuGVEV9ee9TwYzU/82sET/ysq5fdut3HyQnRrBiIrICeoKxHc+sZT7tpuwKy25x7E+e1OvYucXxnJ6Uk4vtVT9IipP+fIvZqm0MpgZNPgsul45rugrqym71HrW9FGrsi9jUu67wXefJQwfJ4QeR7zd6MNktLCdAyH9TRq5Y6KVB+fwWiDHKW6UT5sGOiTf9+jXYLdjPbRHlsdfxb94W10Xnz+aTCYe92Bwwr4ruIeDTqfizu3aw1KOOJNQ9/jGLvzI565rELWCvqZ/9/rKN7E0qRW1iL/3oupG8pWUrUI715oISjKraQfz1Q0q7jWZr+UX9yZfZ+1HMoes4F+9LWP4hraXzM/CESWZf+SnkeXe2FWN01YiKK57sFoFOP7hQOZvHR0vjFlmbT4XdhWDmcfHOj9KLKkIES9gQgRPXGuH2KPHbfBZS35LzY9EPTbqPThCBb0Y5LRXg9MOYk27whpb0t49XuJUCPShYT1L+Zn3fix/o/VvdNpJxC6ZS9FlFF9UkUzmxkxGZ0ThJceW3M8HE6086J/EPdOeMIXL9nVcOWinuYjl/IjxvrlNu3mP97lahQvHcnE77Wrq2et0Lov5DufyQtzYzmp+ylJ+6L13Iw4bfB2ihNMv4AYm8R9ex9PIEt7nOm8caATX6LjSYRq9Th8dV7qF8/mTWhg4nfBH3M5nznwwsTBO8kXxJWMA57DRiXJbyp3qfnMFQybkLuGHrHLmhIml8wUaNAKyjEodDxR33gJuYbIvDFsi+CQUXuqDziW7Q91eu1ig4oETaNIevwVX4zwYiAVziCZn2/iEu+m3cNx95K875UBcdGt4mDHq+qzWvaVeH/B9tdCkjSfzUxWtAUzy3ffF/IV7mcgPvG0SZfgm13vXdQ4PqWhJIMUex6ryi4wEZPjr8S5/x1R+6h1vC6/zurZTbGztTO5Uu2ob73jjY/0yTBCXeVs9fQ9LYQ15N7LDRMtQq0nGu3bxtjbGCn7CFp7XYAtxs23jT04jxWbw9NbONvZTHM03PReeuOP+xDjqmKXWWywb/Kq4BnYDOJp8bih0XOIRdvKOZsWQ8bUtPndRL8Ywmf/Q1xIm3+ZYIuhT+lpeZAJDuEQFZQdv0cIW7/Pp/J4K+qa9yaP5Kku5S8VE3HMvcgZDuVQ7WzmefyLsRcyngt76WkLaP+In+no1P2cHb1PLqXr+Lb75TcOZx0QnKGK3T6xrk3TGjT4XrpvNwx+EUZMkC0lDkrGk2GjYd1nKf9X373Ajq/k3ajmFA2zXTBVHnDFK2dbfcffKw8g4bmIlD+n7hdymARZ9GKvivNWZQ4XOl/oO45zJ5eJWdK07VzhxQt8lpH2JYzEv42ds5XWtp+TFkHq41HMlp/Mjp52W+K55fLLbZhyjmGgZymQe53Wm6oRfnOVHGn0d7BA+z2bHGpHACZfjuJR6buITp5M7xG6dt+USC9goUwsO7SBjqYnccHcZ3xJ3UmwsZ1WCyEm6p6n8xstx2BgXJj+EFjarG3FDuwwePRjEWTzCIGZnvMES4DGDF3iNOeoCFLfihnYBKxJsIRGC/rD5idylgrLBmZQrrsUGX2eLCtv3Od3nVt3sE+NkltYGp43xCdBm31hi+/EsNFT9Wd/nRzv4M7lP6+eGr+/kff3nZyxf4xz+PW7bWfxP9rDWE5Tt/Fn/HSXCJLXAvu+7rqPi0378aRL3aCCJhL7juAnbuwpP5QdM9s3LW+8bCzTRMvx0q+fH+ghoGTGyK9dVZ9OLNTKc63QOkrjgjtCsbj6xmqbwBCO4Xh1v4g4cxY3610XmdUkQhoSVy75i8UgyXRmDOovHNXefHE8CKSSEXay1pdym5cXVeCEfEKFCBVPSAcl5B3K+pmA6lf+mguXWfx2PeoEY0/g/DOMKtQDkvJKTrx+TNPuFCJY7iTmbdqhmhI59yfiRuL5ECKVNZN7SidzKWfwiIUgjom7LK+nBQLXSDmkdylXgRnIlU/kFo7gmbh8RNWkPsVzG8g1vbAkd4ZCRqcU6BiXnPUHdeRHdxw1GGMtNVDpRlDhjihJ0IXUQ1564AP1h1DI/S7JStNKi1yXjWeJKHcZcpnA/JyWJuiujjBO4Tq0kaYdDek/LVTzquVonDQ/n83Ft2cBybbs+jGEsX6XamdztlhnNNeoyjFmzDdpOYuHVcxXn8QijuTKuDhKEUUG1XvN4vqVT2e03HMxxOuNYlsapE491rHzhJXAiZgX1zOlYIh7iJpKot1TlJJDiRcfKGMA0ZjpuyVhAwC66UZ0wD8k91n8ynZ1O+UtZ70UPiksxol17P9KRbZvL9cuYleS8S1fOj0iOXIMb8Zf7/Y2m3CuI74qMi4kwViWZT5buOHJdsqBj+2CIfOskSXJFbP3HswdPE61s62TuQSMpySbKZkOqOV5+9sQFGxwNAolorFldyv3aNMYttq+4Bv2pmirTRJflQz7Xny4DfHYUdsi+e4axvdT7dfS64qnM8GBhGOmw3ING0dnqBXbE1uTKFknjJGNmqGgdb3FZhnEMYpaWUXTESqpzJtrWOXnvskHGTKS8jMsM44t24wzjGMTGtHIsZ/5wuy/ZlrO2tOsL8nw2phXD3IOGYRhGaDDRMgzDMEKDiZZhGIYRGky0DMMwjNBgomUYhmGEBhMtwygQUWtYwwgcEy3DKBA29dkwgsdEyzAKhFlahhE8JlqGUSDM0jKM4DHRMowCYZaWYQSPiZZhFAiztAwjeEy0DKNAmKVlGMFjomUYBcIsLcMIHhMtwzAMIzSYaBmGYRjhAPj/DyUWjT5W+J8AAAAASUVORK5CYII='

  var backgroundURL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAAABmJLR0QA/wD/AP+gvaeTAAAZYklEQVR4nOzYMRKDMBAEQfBH/P9X4tQZBLLKV9Mdw+riOd/HdR1fzuPe3TdTNqbcaWP/Gzb+c2PKnTb2v2Fj/caUO23sf8PG+o0pd9pYvzHlThv73/jVxuvBPwAAAMBwAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAAAECAAAAAAQIAAAAABAgAAAAAAAAQIAAAAABAgAAAAAECAAAAAAQIAAAAAAAAECAAAAAAQIAAAAABAgAAAAAECAAAAAAAABAgAAAHzasQMBAAAAAEH+1oNcGAEMCAAAAAAYCEVwCpbh5pN9AAAAAElFTkSuQmCC'

  var abstractFont = '15fda0823f200837.ttf'

  const size = 1024
  var stylesLoader = () => {
    // const logoURL = await resolveGlobal('../assets/images/dapp-logo-bg.png')
    // const backgroundURL = await resolveGlobal('../assets/images/background.png')
    const defaultTemplate = {
      text: '',
      width: size,
      height: size,
      colorDark: '#000000',
      colorLight: 'rgba(0,0,0,0)',
      drawer: 'canvas',
      logo: logoURL,
      logoWidth: 433,
      logoHeight: 118,
      dotScale: 1,
      logoBackgroundTransparent: true,
      backgroundImage: backgroundURL,
      autoColor: false,
      quietZone: 60
    }
    const styles = {
      //default: defaultTemplate,
      boxed: {
        ...defaultTemplate,
        quietZone: 60,
        quietZoneColor: 'rgba(0,0,0,0)',
        title: DefaultQRTitle,
        subTitle: DefaultQRSubTitle,
        titleTop: -25,
        subTitleTop: -8,
        titleHeight: 0,
        titleBackgroundColor: 'rgba(0,0,0,0)',
        titleColor: '#111111',
        subTitleColor: '#222222',
        titleFont: 'normal normal bold 12px Abstract',
        subTitleFont: 'normal normal bold 9px Abstract'
      },
      printable: {
        ...defaultTemplate,
        logo: undefined,
        logoWidth: undefined,
        logoHeight: undefined,
        colorDark: '#000000',
        colorLight: '#ffffff',
        backgroundImage: undefined,
        title: DefaultQRTitle,
        subTitle: DefaultQRSubTitle,
        quietZone: 60,
        quietZoneColor: 'rgba(0,0,0,0)',
        titleTop: -25,
        subTitleTop: -8,
        titleHeight: 0,
        titleBackgroundColor: '#ffffff',
        titleColor: '#000000',
        subTitleColor: '#000000',
        titleFont: 'normal normal bold 12px Abstract',
        subTitleFont: 'normal normal bold 9px Abstract'
      }
    }
    const fonts = [{ file: abstractFont, def: { family: 'Abstract' } }]
    return { styles, fonts }
  }

  //import { createReadStream, createWriteStream, } from 'fs'
  var QREncoder = async (args) => {
    try {
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const { styles, fonts } = stylesLoader()
      const { registerFonts } = await qrLibLoader()
      registerFonts(fonts)
      const template =
        args?.template && styles[args?.template]
          ? args?.template
          : DefaultQRTemplate
      let style = styles[template]
      if (args?.styles) {
        try {
          style = {
            ...style,
            ...(JSON.parse(args?.styles) || {})
          }
        } catch (err) {
          throw new Error(
            `Error applying style layer over '${template}'. ${err}`
          )
        }
      }
      const dataURI = await handler.encoder(obj, {
        urlPattern,
        encoding,
        qrCodeStyle: style,
        qrResultType: args?.qrResultType
      })
      return dataURI
    } catch (err) {
      if (err instanceof Error)
        throw new Error('QR URL generation failed. ' + err?.message)
      else throw new Error('QR URL generation failed. ' + 'Unknown error')
    }
  }

  var ButtonEncoder = async (args) => {
    try {
      throw new Error('Not implemented yet')
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const url = await handler$1.encoder(obj, {
        urlPattern,
        encoding
      })
      return url
    } catch (err) {
      if (err instanceof Error)
        throw new Error('URL generation failed. ' + err?.message)
      else throw new Error('URL generation failed. ' + 'Unknown error')
    }
  }

  var HtmlEncoder = async (args) => {
    try {
      throw new Error('Not implemented yet')
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const url = await handler$1.encoder(obj, {
        urlPattern,
        encoding
      })
      return url
    } catch (err) {
      if (err instanceof Error)
        throw new Error('URL generation failed. ' + err?.message)
      else throw new Error('URL generation failed. ' + 'Unknown error')
    }
  }

  var ReactEncoder = async (args) => {
    try {
      throw new Error('Not implemented yet')
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const url = await handler$1.encoder(obj, {
        urlPattern,
        encoding
      })
      return url
    } catch (err) {
      if (err instanceof Error)
        throw new Error('URL generation failed. ' + err?.message)
      else throw new Error('URL generation failed. ' + 'Unknown error')
    }
  }

  var ExpressEncoder = async (args) => {
    try {
      throw new Error('Not implemented yet')
      const { apiVersion, network, encoding, input } =
        validateBuildMsgArgs(args)
      const obj = JSON.parse(input)
      const urlPattern = GCDappConnUrls[apiVersion][network]
      if (!urlPattern)
        throw new Error(`Missing URL pattern for network '${network || ''}'`)
      const url = await handler$1.encoder(obj, {
        urlPattern,
        encoding
      })
      return url
    } catch (err) {
      if (err instanceof Error)
        throw new Error('URL generation failed. ' + err?.message)
      else throw new Error('URL generation failed. ' + 'Unknown error')
    }
  }

  var encode = {
    url: URLEncoder,
    qr: QREncoder,
    button: ButtonEncoder,
    html: HtmlEncoder,
    express: ExpressEncoder,
    react: ReactEncoder
  }

  var _handlers = {
    encode
  }
  // import { ActionHandlerType} from '../types';
  // import URLEncoder from './encode/url';
  // import QREncoder  from './encode/qr';
  // import ButtonEncoder  from './encode/button';
  // import HtmlEncoder  from './encode/html';
  // import ReactEncoder  from './encode/react';
  // import ExpressEncoder  from './encode/express';
  // export const actionsHandlerLoaders: ActionHandlerLoaderType = {
  // 	encode: {
  // 		'url': ()=>import(`./encode/url`).then(d=>d?.default),
  // 		'qr' : ()=>import(`./encode/qr`) .then(d=>d?.default),
  // 	},
  // };
  //export const handlers: ActionHandlerType = {

  const baseEncodings = {
    gzip: handler$6,
    'json-url-lzma': handler$5,
    'json-url-lzw': handler$4,
    base64url: handler$3
  }
  var _encodings = {
    ...baseEncodings,
    msg: handler$2,
    url: handler$1,
    qr: handler
  }

  const encodings = _encodings
  const gc = _handlers
  // export const cli =
  //   typeof window === 'object'
  //     ? undefined
  //     : import('./cli.ts.old').then((d) => d.default())
  const config = {
    usageMessage,
    QRRenderTypes
  }
  const testDeps = _testDeps

  var jsonUrl = () => {
    const isNode = typeof process === 'object' && typeof window !== 'object'
    const pathStr = isNode ? 'json-url' : '../../dist/json-url-single.js'
    //WORKS: 'https://cdn.jsdelivr.net/npm/json-url@3.1.0/dist/browser/json-url-single.min.js' //'json-url/dist/browser/json-url-single.js'
    return import(pathStr).then((jsonUrlLib) => {
      //console.log({ jsonUrlLib, browser: window?.JsonUrl })
      if (!isNode) return window.JsonUrl
      return jsonUrlLib.default
    })
  }

  var jsonUrl$1 = /*#__PURE__*/ Object.freeze({
    __proto__: null,
    default: jsonUrl
  })

  /// © 2015 Nathan Rugg <nmrugg@gmail.com> | MIT
  /// See LICENSE for more details.

  /* jshint noarg:true, boss:true, unused:strict, strict:true, undef:true, noarg: true, forin:true, evil:true, newcap:false, -W041, -W021, worker:true, browser:true, node:true */

  /* global setImmediate, setTimeout, window, onmessage */

  /** xs */
  ///NOTE: This is the master file that is used to generate lzma-c.js and lzma-d.js.
  ///      Comments are used to determine which parts are to be removed.
  ///
  /// cs-ce (compression start-end)
  /// ds-de (decompression start-end)
  /// xs-xe (only in this file start-end)
  /// co    (compression only)
  /// do    (decompression only)
  /** xe */

  var LZMA = (function () {
    var /** cs */
      action_compress = 1,
      /** ce */
      /** ds */
      action_decompress = 2,
      /** de */
      action_progress = 3,
      wait = typeof setImmediate == 'function' ? setImmediate : setTimeout,
      __4294967296 = 4294967296,
      N1_longLit = [4294967295, -__4294967296],
      /** cs */
      MIN_VALUE = [0, -9223372036854775808],
      /** ce */
      P0_longLit = [0, 0],
      P1_longLit = [1, 0]

    function update_progress(percent, cbn) {
      postMessage({
        action: action_progress,
        cbn: cbn,
        result: percent
      })
    }

    function initDim(len) {
      ///NOTE: This is MUCH faster than "new Array(len)" in newer versions of v8 (starting with Node.js 0.11.15, which uses v8 3.28.73).
      var a = []
      a[len - 1] = undefined
      return a
    }

    function add(a, b) {
      return create(a[0] + b[0], a[1] + b[1])
    }

    /** cs */
    function and(a, b) {
      return makeFromBits(
        ~~Math.max(Math.min(a[1] / __4294967296, 2147483647), -2147483648) &
          ~~Math.max(Math.min(b[1] / __4294967296, 2147483647), -2147483648),
        lowBits_0(a) & lowBits_0(b)
      )
    }
    /** ce */

    function compare(a, b) {
      var nega, negb
      if (a[0] == b[0] && a[1] == b[1]) {
        return 0
      }
      nega = a[1] < 0
      negb = b[1] < 0
      if (nega && !negb) {
        return -1
      }
      if (!nega && negb) {
        return 1
      }
      if (sub(a, b)[1] < 0) {
        return -1
      }
      return 1
    }

    function create(valueLow, valueHigh) {
      var diffHigh, diffLow
      valueHigh %= 1.8446744073709552e19
      valueLow %= 1.8446744073709552e19
      diffHigh = valueHigh % __4294967296
      diffLow = Math.floor(valueLow / __4294967296) * __4294967296
      valueHigh = valueHigh - diffHigh + diffLow
      valueLow = valueLow - diffLow + diffHigh
      while (valueLow < 0) {
        valueLow += __4294967296
        valueHigh -= __4294967296
      }
      while (valueLow > 4294967295) {
        valueLow -= __4294967296
        valueHigh += __4294967296
      }
      valueHigh = valueHigh % 1.8446744073709552e19
      while (valueHigh > 9223372032559808512) {
        valueHigh -= 1.8446744073709552e19
      }
      while (valueHigh < -9223372036854775808) {
        valueHigh += 1.8446744073709552e19
      }
      return [valueLow, valueHigh]
    }

    /** cs */
    function eq(a, b) {
      return a[0] == b[0] && a[1] == b[1]
    }
    /** ce */
    function fromInt(value) {
      if (value >= 0) {
        return [value, 0]
      } else {
        return [value + __4294967296, -__4294967296]
      }
    }

    function lowBits_0(a) {
      if (a[0] >= 2147483648) {
        return ~~Math.max(
          Math.min(a[0] - __4294967296, 2147483647),
          -2147483648
        )
      } else {
        return ~~Math.max(Math.min(a[0], 2147483647), -2147483648)
      }
    }
    /** cs */
    function makeFromBits(highBits, lowBits) {
      var high, low
      high = highBits * __4294967296
      low = lowBits
      if (lowBits < 0) {
        low += __4294967296
      }
      return [low, high]
    }

    function pwrAsDouble(n) {
      if (n <= 30) {
        return 1 << n
      } else {
        return pwrAsDouble(30) * pwrAsDouble(n - 30)
      }
    }

    function shl(a, n) {
      var diff, newHigh, newLow, twoToN
      n &= 63
      if (eq(a, MIN_VALUE)) {
        if (!n) {
          return a
        }
        return P0_longLit
      }
      if (a[1] < 0) {
        throw new Error('Neg')
      }
      twoToN = pwrAsDouble(n)
      newHigh = (a[1] * twoToN) % 1.8446744073709552e19
      newLow = a[0] * twoToN
      diff = newLow - (newLow % __4294967296)
      newHigh += diff
      newLow -= diff
      if (newHigh >= 9223372036854775807) {
        newHigh -= 1.8446744073709552e19
      }
      return [newLow, newHigh]
    }

    function shr(a, n) {
      var shiftFact
      n &= 63
      shiftFact = pwrAsDouble(n)
      return create(Math.floor(a[0] / shiftFact), a[1] / shiftFact)
    }

    function shru(a, n) {
      var sr
      n &= 63
      sr = shr(a, n)
      if (a[1] < 0) {
        sr = add(sr, shl([2, 0], 63 - n))
      }
      return sr
    }

    /** ce */

    function sub(a, b) {
      return create(a[0] - b[0], a[1] - b[1])
    }

    function $ByteArrayInputStream(this$static, buf) {
      this$static.buf = buf
      this$static.pos = 0
      this$static.count = buf.length
      return this$static
    }

    /** ds */
    function $read(this$static) {
      if (this$static.pos >= this$static.count) return -1
      return this$static.buf[this$static.pos++] & 255
    }
    /** de */
    /** cs */
    function $read_0(this$static, buf, off, len) {
      if (this$static.pos >= this$static.count) return -1
      len = Math.min(len, this$static.count - this$static.pos)
      arraycopy(this$static.buf, this$static.pos, buf, off, len)
      this$static.pos += len
      return len
    }
    /** ce */

    function $ByteArrayOutputStream(this$static) {
      this$static.buf = initDim(32)
      this$static.count = 0
      return this$static
    }

    function $toByteArray(this$static) {
      var data = this$static.buf
      data.length = this$static.count
      return data
    }

    /** cs */
    function $write(this$static, b) {
      this$static.buf[this$static.count++] = (b << 24) >> 24
    }
    /** ce */

    function $write_0(this$static, buf, off, len) {
      arraycopy(buf, off, this$static.buf, this$static.count, len)
      this$static.count += len
    }

    /** cs */
    function $getChars(this$static, srcBegin, srcEnd, dst, dstBegin) {
      var srcIdx
      for (srcIdx = srcBegin; srcIdx < srcEnd; ++srcIdx) {
        dst[dstBegin++] = this$static.charCodeAt(srcIdx)
      }
    }
    /** ce */

    function arraycopy(src, srcOfs, dest, destOfs, len) {
      for (var i = 0; i < len; ++i) {
        dest[destOfs + i] = src[srcOfs + i]
      }
    }

    /** cs */
    function $configure(this$static, encoder) {
      $SetDictionarySize_0(encoder, 1 << this$static.s)
      encoder._numFastBytes = this$static.f
      $SetMatchFinder(encoder, this$static.m)

      /// lc is always 3
      /// lp is always 0
      /// pb is always 2
      encoder._numLiteralPosStateBits = 0
      encoder._numLiteralContextBits = 3
      encoder._posStateBits = 2
      ///this$static._posStateMask = (1 << pb) - 1;
      encoder._posStateMask = 3
    }

    function $init(this$static, input, output, length_0, mode) {
      var encoder, i
      if (compare(length_0, N1_longLit) < 0)
        throw new Error('invalid length ' + length_0)
      this$static.length_0 = length_0
      encoder = $Encoder({})
      $configure(mode, encoder)
      encoder._writeEndMark = typeof LZMA.disableEndMark == 'undefined'
      $WriteCoderProperties(encoder, output)
      for (i = 0; i < 64; i += 8)
        $write(output, lowBits_0(shr(length_0, i)) & 255)
      this$static.chunker =
        ((encoder._needReleaseMFStream = 0),
        ((encoder._inStream = input),
        (encoder._finished = 0),
        $Create_2(encoder),
        (encoder._rangeEncoder.Stream = output),
        $Init_4(encoder),
        $FillDistancesPrices(encoder),
        $FillAlignPrices(encoder),
        (encoder._lenEncoder._tableSize = encoder._numFastBytes + 1 - 2),
        $UpdateTables(encoder._lenEncoder, 1 << encoder._posStateBits),
        (encoder._repMatchLenEncoder._tableSize =
          encoder._numFastBytes + 1 - 2),
        $UpdateTables(encoder._repMatchLenEncoder, 1 << encoder._posStateBits),
        (encoder.nowPos64 = P0_longLit),
        undefined),
        $Chunker_0({}, encoder))
    }

    function $LZMAByteArrayCompressor(this$static, data, mode) {
      this$static.output = $ByteArrayOutputStream({})
      $init(
        this$static,
        $ByteArrayInputStream({}, data),
        this$static.output,
        fromInt(data.length),
        mode
      )
      return this$static
    }
    /** ce */

    /** ds */
    function $init_0(this$static, input, output) {
      var decoder,
        hex_length = '',
        i,
        properties = [],
        r,
        tmp_length

      for (i = 0; i < 5; ++i) {
        r = $read(input)
        if (r == -1) throw new Error('truncated input')
        properties[i] = (r << 24) >> 24
      }

      decoder = $Decoder({})
      if (!$SetDecoderProperties(decoder, properties)) {
        throw new Error('corrupted input')
      }
      for (i = 0; i < 64; i += 8) {
        r = $read(input)
        if (r == -1) throw new Error('truncated input')
        r = r.toString(16)
        if (r.length == 1) r = '0' + r
        hex_length = r + '' + hex_length
      }

      /// Was the length set in the header (if it was compressed from a stream, the length is all f"s).
      if (/^0+$|^f+$/i.test(hex_length)) {
        /// The length is unknown, so set to -1.
        this$static.length_0 = N1_longLit
      } else {
        ///NOTE: If there is a problem with the decoder because of the length, you can always set the length to -1 (N1_longLit) which means unknown.
        tmp_length = parseInt(hex_length, 16)
        /// If the length is too long to handle, just set it to unknown.
        if (tmp_length > 4294967295) {
          this$static.length_0 = N1_longLit
        } else {
          this$static.length_0 = fromInt(tmp_length)
        }
      }

      this$static.chunker = $CodeInChunks(
        decoder,
        input,
        output,
        this$static.length_0
      )
    }

    function $LZMAByteArrayDecompressor(this$static, data) {
      this$static.output = $ByteArrayOutputStream({})
      $init_0(this$static, $ByteArrayInputStream({}, data), this$static.output)
      return this$static
    }
    /** de */
    /** cs */
    function $Create_4(
      this$static,
      keepSizeBefore,
      keepSizeAfter,
      keepSizeReserv
    ) {
      var blockSize
      this$static._keepSizeBefore = keepSizeBefore
      this$static._keepSizeAfter = keepSizeAfter
      blockSize = keepSizeBefore + keepSizeAfter + keepSizeReserv
      if (
        this$static._bufferBase == null ||
        this$static._blockSize != blockSize
      ) {
        this$static._bufferBase = null
        this$static._blockSize = blockSize
        this$static._bufferBase = initDim(this$static._blockSize)
      }
      this$static._pointerToLastSafePosition =
        this$static._blockSize - keepSizeAfter
    }

    function $GetIndexByte(this$static, index) {
      return this$static._bufferBase[
        this$static._bufferOffset + this$static._pos + index
      ]
    }

    function $GetMatchLen(this$static, index, distance, limit) {
      var i, pby
      if (this$static._streamEndWasReached) {
        if (this$static._pos + index + limit > this$static._streamPos) {
          limit = this$static._streamPos - (this$static._pos + index)
        }
      }
      ++distance
      pby = this$static._bufferOffset + this$static._pos + index
      for (
        i = 0;
        i < limit &&
        this$static._bufferBase[pby + i] ==
          this$static._bufferBase[pby + i - distance];
        ++i
      ) {}
      return i
    }

    function $GetNumAvailableBytes(this$static) {
      return this$static._streamPos - this$static._pos
    }

    function $MoveBlock(this$static) {
      var i, numBytes, offset
      offset =
        this$static._bufferOffset +
        this$static._pos -
        this$static._keepSizeBefore
      if (offset > 0) {
        --offset
      }
      numBytes = this$static._bufferOffset + this$static._streamPos - offset
      for (i = 0; i < numBytes; ++i) {
        this$static._bufferBase[i] = this$static._bufferBase[offset + i]
      }
      this$static._bufferOffset -= offset
    }

    function $MovePos_1(this$static) {
      var pointerToPostion
      ++this$static._pos
      if (this$static._pos > this$static._posLimit) {
        pointerToPostion = this$static._bufferOffset + this$static._pos
        if (pointerToPostion > this$static._pointerToLastSafePosition) {
          $MoveBlock(this$static)
        }
        $ReadBlock(this$static)
      }
    }

    function $ReadBlock(this$static) {
      var numReadBytes, pointerToPostion, size
      if (this$static._streamEndWasReached) return
      while (1) {
        size =
          -this$static._bufferOffset +
          this$static._blockSize -
          this$static._streamPos
        if (!size) return
        numReadBytes = $read_0(
          this$static._stream,
          this$static._bufferBase,
          this$static._bufferOffset + this$static._streamPos,
          size
        )
        if (numReadBytes == -1) {
          this$static._posLimit = this$static._streamPos
          pointerToPostion = this$static._bufferOffset + this$static._posLimit
          if (pointerToPostion > this$static._pointerToLastSafePosition) {
            this$static._posLimit =
              this$static._pointerToLastSafePosition - this$static._bufferOffset
          }
          this$static._streamEndWasReached = 1
          return
        }
        this$static._streamPos += numReadBytes
        if (
          this$static._streamPos >=
          this$static._pos + this$static._keepSizeAfter
        ) {
          this$static._posLimit =
            this$static._streamPos - this$static._keepSizeAfter
        }
      }
    }

    function $ReduceOffsets(this$static, subValue) {
      this$static._bufferOffset += subValue
      this$static._posLimit -= subValue
      this$static._pos -= subValue
      this$static._streamPos -= subValue
    }

    var CrcTable = (function () {
      var i,
        j,
        r,
        CrcTable = []
      for (i = 0; i < 256; ++i) {
        r = i
        for (j = 0; j < 8; ++j)
          if ((r & 1) != 0) {
            r = (r >>> 1) ^ -306674912
          } else {
            r >>>= 1
          }
        CrcTable[i] = r
      }
      return CrcTable
    })()

    function $Create_3(
      this$static,
      historySize,
      keepAddBufferBefore,
      matchMaxLen,
      keepAddBufferAfter
    ) {
      var cyclicBufferSize, hs, windowReservSize
      if (historySize < 1073741567) {
        this$static._cutValue = 16 + (matchMaxLen >> 1)
        windowReservSize =
          ~~(
            (historySize +
              keepAddBufferBefore +
              matchMaxLen +
              keepAddBufferAfter) /
            2
          ) + 256
        $Create_4(
          this$static,
          historySize + keepAddBufferBefore,
          matchMaxLen + keepAddBufferAfter,
          windowReservSize
        )
        this$static._matchMaxLen = matchMaxLen
        cyclicBufferSize = historySize + 1
        if (this$static._cyclicBufferSize != cyclicBufferSize) {
          this$static._son = initDim(
            (this$static._cyclicBufferSize = cyclicBufferSize) * 2
          )
        }

        hs = 65536
        if (this$static.HASH_ARRAY) {
          hs = historySize - 1
          hs |= hs >> 1
          hs |= hs >> 2
          hs |= hs >> 4
          hs |= hs >> 8
          hs >>= 1
          hs |= 65535
          if (hs > 16777216) hs >>= 1
          this$static._hashMask = hs
          ++hs
          hs += this$static.kFixHashSize
        }

        if (hs != this$static._hashSizeSum) {
          this$static._hash = initDim((this$static._hashSizeSum = hs))
        }
      }
    }

    function $GetMatches(this$static, distances) {
      var count,
        cur,
        curMatch,
        curMatch2,
        curMatch3,
        cyclicPos,
        delta,
        hash2Value,
        hash3Value,
        hashValue,
        len,
        len0,
        len1,
        lenLimit,
        matchMinPos,
        maxLen,
        offset,
        pby1,
        ptr0,
        ptr1,
        temp
      if (
        this$static._pos + this$static._matchMaxLen <=
        this$static._streamPos
      ) {
        lenLimit = this$static._matchMaxLen
      } else {
        lenLimit = this$static._streamPos - this$static._pos
        if (lenLimit < this$static.kMinMatchCheck) {
          $MovePos_0(this$static)
          return 0
        }
      }
      offset = 0
      matchMinPos =
        this$static._pos > this$static._cyclicBufferSize
          ? this$static._pos - this$static._cyclicBufferSize
          : 0
      cur = this$static._bufferOffset + this$static._pos
      maxLen = 1
      hash2Value = 0
      hash3Value = 0
      if (this$static.HASH_ARRAY) {
        temp =
          CrcTable[this$static._bufferBase[cur] & 255] ^
          (this$static._bufferBase[cur + 1] & 255)
        hash2Value = temp & 1023
        temp ^= (this$static._bufferBase[cur + 2] & 255) << 8
        hash3Value = temp & 65535
        hashValue =
          (temp ^ (CrcTable[this$static._bufferBase[cur + 3] & 255] << 5)) &
          this$static._hashMask
      } else {
        hashValue =
          (this$static._bufferBase[cur] & 255) ^
          ((this$static._bufferBase[cur + 1] & 255) << 8)
      }

      curMatch = this$static._hash[this$static.kFixHashSize + hashValue] || 0
      if (this$static.HASH_ARRAY) {
        curMatch2 = this$static._hash[hash2Value] || 0
        curMatch3 = this$static._hash[1024 + hash3Value] || 0
        this$static._hash[hash2Value] = this$static._pos
        this$static._hash[1024 + hash3Value] = this$static._pos
        if (curMatch2 > matchMinPos) {
          if (
            this$static._bufferBase[this$static._bufferOffset + curMatch2] ==
            this$static._bufferBase[cur]
          ) {
            distances[offset++] = maxLen = 2
            distances[offset++] = this$static._pos - curMatch2 - 1
          }
        }
        if (curMatch3 > matchMinPos) {
          if (
            this$static._bufferBase[this$static._bufferOffset + curMatch3] ==
            this$static._bufferBase[cur]
          ) {
            if (curMatch3 == curMatch2) {
              offset -= 2
            }
            distances[offset++] = maxLen = 3
            distances[offset++] = this$static._pos - curMatch3 - 1
            curMatch2 = curMatch3
          }
        }
        if (offset != 0 && curMatch2 == curMatch) {
          offset -= 2
          maxLen = 1
        }
      }
      this$static._hash[this$static.kFixHashSize + hashValue] = this$static._pos
      ptr0 = (this$static._cyclicBufferPos << 1) + 1
      ptr1 = this$static._cyclicBufferPos << 1
      len0 = len1 = this$static.kNumHashDirectBytes
      if (this$static.kNumHashDirectBytes != 0) {
        if (curMatch > matchMinPos) {
          if (
            this$static._bufferBase[
              this$static._bufferOffset +
                curMatch +
                this$static.kNumHashDirectBytes
            ] != this$static._bufferBase[cur + this$static.kNumHashDirectBytes]
          ) {
            distances[offset++] = maxLen = this$static.kNumHashDirectBytes
            distances[offset++] = this$static._pos - curMatch - 1
          }
        }
      }
      count = this$static._cutValue
      while (1) {
        if (curMatch <= matchMinPos || count-- == 0) {
          this$static._son[ptr0] = this$static._son[ptr1] = 0
          break
        }
        delta = this$static._pos - curMatch
        cyclicPos =
          (delta <= this$static._cyclicBufferPos
            ? this$static._cyclicBufferPos - delta
            : this$static._cyclicBufferPos -
              delta +
              this$static._cyclicBufferSize) << 1
        pby1 = this$static._bufferOffset + curMatch
        len = len0 < len1 ? len0 : len1
        if (
          this$static._bufferBase[pby1 + len] ==
          this$static._bufferBase[cur + len]
        ) {
          while (++len != lenLimit) {
            if (
              this$static._bufferBase[pby1 + len] !=
              this$static._bufferBase[cur + len]
            ) {
              break
            }
          }
          if (maxLen < len) {
            distances[offset++] = maxLen = len
            distances[offset++] = delta - 1
            if (len == lenLimit) {
              this$static._son[ptr1] = this$static._son[cyclicPos]
              this$static._son[ptr0] = this$static._son[cyclicPos + 1]
              break
            }
          }
        }
        if (
          (this$static._bufferBase[pby1 + len] & 255) <
          (this$static._bufferBase[cur + len] & 255)
        ) {
          this$static._son[ptr1] = curMatch
          ptr1 = cyclicPos + 1
          curMatch = this$static._son[ptr1]
          len1 = len
        } else {
          this$static._son[ptr0] = curMatch
          ptr0 = cyclicPos
          curMatch = this$static._son[ptr0]
          len0 = len
        }
      }
      $MovePos_0(this$static)
      return offset
    }

    function $Init_5(this$static) {
      this$static._bufferOffset = 0
      this$static._pos = 0
      this$static._streamPos = 0
      this$static._streamEndWasReached = 0
      $ReadBlock(this$static)
      this$static._cyclicBufferPos = 0
      $ReduceOffsets(this$static, -1)
    }

    function $MovePos_0(this$static) {
      var subValue
      if (++this$static._cyclicBufferPos >= this$static._cyclicBufferSize) {
        this$static._cyclicBufferPos = 0
      }
      $MovePos_1(this$static)
      if (this$static._pos == 1073741823) {
        subValue = this$static._pos - this$static._cyclicBufferSize
        $NormalizeLinks(
          this$static._son,
          this$static._cyclicBufferSize * 2,
          subValue
        )
        $NormalizeLinks(this$static._hash, this$static._hashSizeSum, subValue)
        $ReduceOffsets(this$static, subValue)
      }
    }

    ///NOTE: This is only called after reading one whole gigabyte.
    function $NormalizeLinks(items, numItems, subValue) {
      var i, value
      for (i = 0; i < numItems; ++i) {
        value = items[i] || 0
        if (value <= subValue) {
          value = 0
        } else {
          value -= subValue
        }
        items[i] = value
      }
    }

    function $SetType(this$static, numHashBytes) {
      this$static.HASH_ARRAY = numHashBytes > 2
      if (this$static.HASH_ARRAY) {
        this$static.kNumHashDirectBytes = 0
        this$static.kMinMatchCheck = 4
        this$static.kFixHashSize = 66560
      } else {
        this$static.kNumHashDirectBytes = 2
        this$static.kMinMatchCheck = 3
        this$static.kFixHashSize = 0
      }
    }

    function $Skip(this$static, num) {
      var count,
        cur,
        curMatch,
        cyclicPos,
        delta,
        hash2Value,
        hash3Value,
        hashValue,
        len,
        len0,
        len1,
        lenLimit,
        matchMinPos,
        pby1,
        ptr0,
        ptr1,
        temp
      do {
        if (
          this$static._pos + this$static._matchMaxLen <=
          this$static._streamPos
        ) {
          lenLimit = this$static._matchMaxLen
        } else {
          lenLimit = this$static._streamPos - this$static._pos
          if (lenLimit < this$static.kMinMatchCheck) {
            $MovePos_0(this$static)
            continue
          }
        }
        matchMinPos =
          this$static._pos > this$static._cyclicBufferSize
            ? this$static._pos - this$static._cyclicBufferSize
            : 0
        cur = this$static._bufferOffset + this$static._pos
        if (this$static.HASH_ARRAY) {
          temp =
            CrcTable[this$static._bufferBase[cur] & 255] ^
            (this$static._bufferBase[cur + 1] & 255)
          hash2Value = temp & 1023
          this$static._hash[hash2Value] = this$static._pos
          temp ^= (this$static._bufferBase[cur + 2] & 255) << 8
          hash3Value = temp & 65535
          this$static._hash[1024 + hash3Value] = this$static._pos
          hashValue =
            (temp ^ (CrcTable[this$static._bufferBase[cur + 3] & 255] << 5)) &
            this$static._hashMask
        } else {
          hashValue =
            (this$static._bufferBase[cur] & 255) ^
            ((this$static._bufferBase[cur + 1] & 255) << 8)
        }
        curMatch = this$static._hash[this$static.kFixHashSize + hashValue]
        this$static._hash[this$static.kFixHashSize + hashValue] =
          this$static._pos
        ptr0 = (this$static._cyclicBufferPos << 1) + 1
        ptr1 = this$static._cyclicBufferPos << 1
        len0 = len1 = this$static.kNumHashDirectBytes
        count = this$static._cutValue
        while (1) {
          if (curMatch <= matchMinPos || count-- == 0) {
            this$static._son[ptr0] = this$static._son[ptr1] = 0
            break
          }
          delta = this$static._pos - curMatch
          cyclicPos =
            (delta <= this$static._cyclicBufferPos
              ? this$static._cyclicBufferPos - delta
              : this$static._cyclicBufferPos -
                delta +
                this$static._cyclicBufferSize) << 1
          pby1 = this$static._bufferOffset + curMatch
          len = len0 < len1 ? len0 : len1
          if (
            this$static._bufferBase[pby1 + len] ==
            this$static._bufferBase[cur + len]
          ) {
            while (++len != lenLimit) {
              if (
                this$static._bufferBase[pby1 + len] !=
                this$static._bufferBase[cur + len]
              ) {
                break
              }
            }
            if (len == lenLimit) {
              this$static._son[ptr1] = this$static._son[cyclicPos]
              this$static._son[ptr0] = this$static._son[cyclicPos + 1]
              break
            }
          }
          if (
            (this$static._bufferBase[pby1 + len] & 255) <
            (this$static._bufferBase[cur + len] & 255)
          ) {
            this$static._son[ptr1] = curMatch
            ptr1 = cyclicPos + 1
            curMatch = this$static._son[ptr1]
            len1 = len
          } else {
            this$static._son[ptr0] = curMatch
            ptr0 = cyclicPos
            curMatch = this$static._son[ptr0]
            len0 = len
          }
        }
        $MovePos_0(this$static)
      } while (--num != 0)
    }

    /** ce */
    /** ds */
    function $CopyBlock(this$static, distance, len) {
      var pos = this$static._pos - distance - 1
      if (pos < 0) {
        pos += this$static._windowSize
      }
      for (; len != 0; --len) {
        if (pos >= this$static._windowSize) {
          pos = 0
        }
        this$static._buffer[this$static._pos++] = this$static._buffer[pos++]
        if (this$static._pos >= this$static._windowSize) {
          $Flush_0(this$static)
        }
      }
    }

    function $Create_5(this$static, windowSize) {
      if (
        this$static._buffer == null ||
        this$static._windowSize != windowSize
      ) {
        this$static._buffer = initDim(windowSize)
      }
      this$static._windowSize = windowSize
      this$static._pos = 0
      this$static._streamPos = 0
    }

    function $Flush_0(this$static) {
      var size = this$static._pos - this$static._streamPos
      if (!size) {
        return
      }
      $write_0(
        this$static._stream,
        this$static._buffer,
        this$static._streamPos,
        size
      )
      if (this$static._pos >= this$static._windowSize) {
        this$static._pos = 0
      }
      this$static._streamPos = this$static._pos
    }

    function $GetByte(this$static, distance) {
      var pos = this$static._pos - distance - 1
      if (pos < 0) {
        pos += this$static._windowSize
      }
      return this$static._buffer[pos]
    }

    function $PutByte(this$static, b) {
      this$static._buffer[this$static._pos++] = b
      if (this$static._pos >= this$static._windowSize) {
        $Flush_0(this$static)
      }
    }

    function $ReleaseStream(this$static) {
      $Flush_0(this$static)
      this$static._stream = null
    }
    /** de */

    function GetLenToPosState(len) {
      len -= 2
      if (len < 4) {
        return len
      }
      return 3
    }

    function StateUpdateChar(index) {
      if (index < 4) {
        return 0
      }
      if (index < 10) {
        return index - 3
      }
      return index - 6
    }

    /** cs */
    function $Chunker_0(this$static, encoder) {
      this$static.encoder = encoder
      this$static.decoder = null
      this$static.alive = 1
      return this$static
    }
    /** ce */
    /** ds */
    function $Chunker(this$static, decoder) {
      this$static.decoder = decoder
      this$static.encoder = null
      this$static.alive = 1
      return this$static
    }
    /** de */

    function $processChunk(this$static) {
      if (!this$static.alive) {
        throw new Error('bad state')
      }

      if (this$static.encoder) {
        /// do:throw new Error("No encoding");
        /** cs */
        $processEncoderChunk(this$static)
        /** ce */
      } else {
        /// co:throw new Error("No decoding");
        /** ds */
        $processDecoderChunk(this$static)
        /** de */
      }
      return this$static.alive
    }

    /** ds */
    function $processDecoderChunk(this$static) {
      var result = $CodeOneChunk(this$static.decoder)
      if (result == -1) {
        throw new Error('corrupted input')
      }
      this$static.inBytesProcessed = N1_longLit
      this$static.outBytesProcessed = this$static.decoder.nowPos64
      if (
        result ||
        (compare(this$static.decoder.outSize, P0_longLit) >= 0 &&
          compare(this$static.decoder.nowPos64, this$static.decoder.outSize) >=
            0)
      ) {
        $Flush_0(this$static.decoder.m_OutWindow)
        $ReleaseStream(this$static.decoder.m_OutWindow)
        this$static.decoder.m_RangeDecoder.Stream = null
        this$static.alive = 0
      }
    }
    /** de */
    /** cs */
    function $processEncoderChunk(this$static) {
      $CodeOneBlock(
        this$static.encoder,
        this$static.encoder.processedInSize,
        this$static.encoder.processedOutSize,
        this$static.encoder.finished
      )
      this$static.inBytesProcessed = this$static.encoder.processedInSize[0]
      if (this$static.encoder.finished[0]) {
        $ReleaseStreams(this$static.encoder)
        this$static.alive = 0
      }
    }
    /** ce */

    /** ds */
    function $CodeInChunks(this$static, inStream, outStream, outSize) {
      this$static.m_RangeDecoder.Stream = inStream
      $ReleaseStream(this$static.m_OutWindow)
      this$static.m_OutWindow._stream = outStream
      $Init_1(this$static)
      this$static.state = 0
      this$static.rep0 = 0
      this$static.rep1 = 0
      this$static.rep2 = 0
      this$static.rep3 = 0
      this$static.outSize = outSize
      this$static.nowPos64 = P0_longLit
      this$static.prevByte = 0
      return $Chunker({}, this$static)
    }

    function $CodeOneChunk(this$static) {
      var decoder2, distance, len, numDirectBits, posSlot, posState
      posState = lowBits_0(this$static.nowPos64) & this$static.m_PosStateMask
      if (
        !$DecodeBit(
          this$static.m_RangeDecoder,
          this$static.m_IsMatchDecoders,
          (this$static.state << 4) + posState
        )
      ) {
        decoder2 = $GetDecoder(
          this$static.m_LiteralDecoder,
          lowBits_0(this$static.nowPos64),
          this$static.prevByte
        )
        if (this$static.state < 7) {
          this$static.prevByte = $DecodeNormal(
            decoder2,
            this$static.m_RangeDecoder
          )
        } else {
          this$static.prevByte = $DecodeWithMatchByte(
            decoder2,
            this$static.m_RangeDecoder,
            $GetByte(this$static.m_OutWindow, this$static.rep0)
          )
        }
        $PutByte(this$static.m_OutWindow, this$static.prevByte)
        this$static.state = StateUpdateChar(this$static.state)
        this$static.nowPos64 = add(this$static.nowPos64, P1_longLit)
      } else {
        if (
          $DecodeBit(
            this$static.m_RangeDecoder,
            this$static.m_IsRepDecoders,
            this$static.state
          )
        ) {
          len = 0
          if (
            !$DecodeBit(
              this$static.m_RangeDecoder,
              this$static.m_IsRepG0Decoders,
              this$static.state
            )
          ) {
            if (
              !$DecodeBit(
                this$static.m_RangeDecoder,
                this$static.m_IsRep0LongDecoders,
                (this$static.state << 4) + posState
              )
            ) {
              this$static.state = this$static.state < 7 ? 9 : 11
              len = 1
            }
          } else {
            if (
              !$DecodeBit(
                this$static.m_RangeDecoder,
                this$static.m_IsRepG1Decoders,
                this$static.state
              )
            ) {
              distance = this$static.rep1
            } else {
              if (
                !$DecodeBit(
                  this$static.m_RangeDecoder,
                  this$static.m_IsRepG2Decoders,
                  this$static.state
                )
              ) {
                distance = this$static.rep2
              } else {
                distance = this$static.rep3
                this$static.rep3 = this$static.rep2
              }
              this$static.rep2 = this$static.rep1
            }
            this$static.rep1 = this$static.rep0
            this$static.rep0 = distance
          }
          if (!len) {
            len =
              $Decode(
                this$static.m_RepLenDecoder,
                this$static.m_RangeDecoder,
                posState
              ) + 2
            this$static.state = this$static.state < 7 ? 8 : 11
          }
        } else {
          this$static.rep3 = this$static.rep2
          this$static.rep2 = this$static.rep1
          this$static.rep1 = this$static.rep0
          len =
            2 +
            $Decode(
              this$static.m_LenDecoder,
              this$static.m_RangeDecoder,
              posState
            )
          this$static.state = this$static.state < 7 ? 7 : 10
          posSlot = $Decode_0(
            this$static.m_PosSlotDecoder[GetLenToPosState(len)],
            this$static.m_RangeDecoder
          )
          if (posSlot >= 4) {
            numDirectBits = (posSlot >> 1) - 1
            this$static.rep0 = (2 | (posSlot & 1)) << numDirectBits
            if (posSlot < 14) {
              this$static.rep0 += ReverseDecode(
                this$static.m_PosDecoders,
                this$static.rep0 - posSlot - 1,
                this$static.m_RangeDecoder,
                numDirectBits
              )
            } else {
              this$static.rep0 +=
                $DecodeDirectBits(
                  this$static.m_RangeDecoder,
                  numDirectBits - 4
                ) << 4
              this$static.rep0 += $ReverseDecode(
                this$static.m_PosAlignDecoder,
                this$static.m_RangeDecoder
              )
              if (this$static.rep0 < 0) {
                if (this$static.rep0 == -1) {
                  return 1
                }
                return -1
              }
            }
          } else this$static.rep0 = posSlot
        }
        if (
          compare(fromInt(this$static.rep0), this$static.nowPos64) >= 0 ||
          this$static.rep0 >= this$static.m_DictionarySizeCheck
        ) {
          return -1
        }
        $CopyBlock(this$static.m_OutWindow, this$static.rep0, len)
        this$static.nowPos64 = add(this$static.nowPos64, fromInt(len))
        this$static.prevByte = $GetByte(this$static.m_OutWindow, 0)
      }
      return 0
    }

    function $Decoder(this$static) {
      this$static.m_OutWindow = {}
      this$static.m_RangeDecoder = {}
      this$static.m_IsMatchDecoders = initDim(192)
      this$static.m_IsRepDecoders = initDim(12)
      this$static.m_IsRepG0Decoders = initDim(12)
      this$static.m_IsRepG1Decoders = initDim(12)
      this$static.m_IsRepG2Decoders = initDim(12)
      this$static.m_IsRep0LongDecoders = initDim(192)
      this$static.m_PosSlotDecoder = initDim(4)
      this$static.m_PosDecoders = initDim(114)
      this$static.m_PosAlignDecoder = $BitTreeDecoder({}, 4)
      this$static.m_LenDecoder = $Decoder$LenDecoder({})
      this$static.m_RepLenDecoder = $Decoder$LenDecoder({})
      this$static.m_LiteralDecoder = {}
      for (var i = 0; i < 4; ++i) {
        this$static.m_PosSlotDecoder[i] = $BitTreeDecoder({}, 6)
      }
      return this$static
    }

    function $Init_1(this$static) {
      this$static.m_OutWindow._streamPos = 0
      this$static.m_OutWindow._pos = 0
      InitBitModels(this$static.m_IsMatchDecoders)
      InitBitModels(this$static.m_IsRep0LongDecoders)
      InitBitModels(this$static.m_IsRepDecoders)
      InitBitModels(this$static.m_IsRepG0Decoders)
      InitBitModels(this$static.m_IsRepG1Decoders)
      InitBitModels(this$static.m_IsRepG2Decoders)
      InitBitModels(this$static.m_PosDecoders)
      $Init_0(this$static.m_LiteralDecoder)
      for (var i = 0; i < 4; ++i) {
        InitBitModels(this$static.m_PosSlotDecoder[i].Models)
      }
      $Init(this$static.m_LenDecoder)
      $Init(this$static.m_RepLenDecoder)
      InitBitModels(this$static.m_PosAlignDecoder.Models)
      $Init_8(this$static.m_RangeDecoder)
    }

    function $SetDecoderProperties(this$static, properties) {
      var dictionarySize, i, lc, lp, pb, remainder, val
      if (properties.length < 5) return 0
      val = properties[0] & 255
      lc = val % 9
      remainder = ~~(val / 9)
      lp = remainder % 5
      pb = ~~(remainder / 5)
      dictionarySize = 0
      for (i = 0; i < 4; ++i) {
        dictionarySize += (properties[1 + i] & 255) << (i * 8)
      }
      ///NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
      if (dictionarySize > 99999999 || !$SetLcLpPb(this$static, lc, lp, pb)) {
        return 0
      }
      return $SetDictionarySize(this$static, dictionarySize)
    }

    function $SetDictionarySize(this$static, dictionarySize) {
      if (dictionarySize < 0) {
        return 0
      }
      if (this$static.m_DictionarySize != dictionarySize) {
        this$static.m_DictionarySize = dictionarySize
        this$static.m_DictionarySizeCheck = Math.max(
          this$static.m_DictionarySize,
          1
        )
        $Create_5(
          this$static.m_OutWindow,
          Math.max(this$static.m_DictionarySizeCheck, 4096)
        )
      }
      return 1
    }

    function $SetLcLpPb(this$static, lc, lp, pb) {
      if (lc > 8 || lp > 4 || pb > 4) {
        return 0
      }
      $Create_0(this$static.m_LiteralDecoder, lp, lc)
      var numPosStates = 1 << pb
      $Create(this$static.m_LenDecoder, numPosStates)
      $Create(this$static.m_RepLenDecoder, numPosStates)
      this$static.m_PosStateMask = numPosStates - 1
      return 1
    }

    function $Create(this$static, numPosStates) {
      for (
        ;
        this$static.m_NumPosStates < numPosStates;
        ++this$static.m_NumPosStates
      ) {
        this$static.m_LowCoder[this$static.m_NumPosStates] = $BitTreeDecoder(
          {},
          3
        )
        this$static.m_MidCoder[this$static.m_NumPosStates] = $BitTreeDecoder(
          {},
          3
        )
      }
    }

    function $Decode(this$static, rangeDecoder, posState) {
      if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 0)) {
        return $Decode_0(this$static.m_LowCoder[posState], rangeDecoder)
      }
      var symbol = 8
      if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 1)) {
        symbol += $Decode_0(this$static.m_MidCoder[posState], rangeDecoder)
      } else {
        symbol += 8 + $Decode_0(this$static.m_HighCoder, rangeDecoder)
      }
      return symbol
    }

    function $Decoder$LenDecoder(this$static) {
      this$static.m_Choice = initDim(2)
      this$static.m_LowCoder = initDim(16)
      this$static.m_MidCoder = initDim(16)
      this$static.m_HighCoder = $BitTreeDecoder({}, 8)
      this$static.m_NumPosStates = 0
      return this$static
    }

    function $Init(this$static) {
      InitBitModels(this$static.m_Choice)
      for (
        var posState = 0;
        posState < this$static.m_NumPosStates;
        ++posState
      ) {
        InitBitModels(this$static.m_LowCoder[posState].Models)
        InitBitModels(this$static.m_MidCoder[posState].Models)
      }
      InitBitModels(this$static.m_HighCoder.Models)
    }

    function $Create_0(this$static, numPosBits, numPrevBits) {
      var i, numStates
      if (
        this$static.m_Coders != null &&
        this$static.m_NumPrevBits == numPrevBits &&
        this$static.m_NumPosBits == numPosBits
      )
        return
      this$static.m_NumPosBits = numPosBits
      this$static.m_PosMask = (1 << numPosBits) - 1
      this$static.m_NumPrevBits = numPrevBits
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      this$static.m_Coders = initDim(numStates)
      for (i = 0; i < numStates; ++i)
        this$static.m_Coders[i] = $Decoder$LiteralDecoder$Decoder2({})
    }

    function $GetDecoder(this$static, pos, prevByte) {
      return this$static.m_Coders[
        ((pos & this$static.m_PosMask) << this$static.m_NumPrevBits) +
          ((prevByte & 255) >>> (8 - this$static.m_NumPrevBits))
      ]
    }

    function $Init_0(this$static) {
      var i, numStates
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      for (i = 0; i < numStates; ++i) {
        InitBitModels(this$static.m_Coders[i].m_Decoders)
      }
    }

    function $DecodeNormal(this$static, rangeDecoder) {
      var symbol = 1
      do {
        symbol =
          (symbol << 1) |
          $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol)
      } while (symbol < 256)
      return (symbol << 24) >> 24
    }

    function $DecodeWithMatchByte(this$static, rangeDecoder, matchByte) {
      var bit,
        matchBit,
        symbol = 1
      do {
        matchBit = (matchByte >> 7) & 1
        matchByte <<= 1
        bit = $DecodeBit(
          rangeDecoder,
          this$static.m_Decoders,
          ((1 + matchBit) << 8) + symbol
        )
        symbol = (symbol << 1) | bit
        if (matchBit != bit) {
          while (symbol < 256) {
            symbol =
              (symbol << 1) |
              $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol)
          }
          break
        }
      } while (symbol < 256)
      return (symbol << 24) >> 24
    }

    function $Decoder$LiteralDecoder$Decoder2(this$static) {
      this$static.m_Decoders = initDim(768)
      return this$static
    }

    /** de */
    /** cs */
    var g_FastPos = (function () {
      var j,
        k,
        slotFast,
        c = 2,
        g_FastPos = [0, 1]
      for (slotFast = 2; slotFast < 22; ++slotFast) {
        k = 1 << ((slotFast >> 1) - 1)
        for (j = 0; j < k; ++j, ++c) g_FastPos[c] = (slotFast << 24) >> 24
      }
      return g_FastPos
    })()

    function $Backward(this$static, cur) {
      var backCur, backMem, posMem, posPrev
      this$static._optimumEndIndex = cur
      posMem = this$static._optimum[cur].PosPrev
      backMem = this$static._optimum[cur].BackPrev
      do {
        if (this$static._optimum[cur].Prev1IsChar) {
          $MakeAsChar(this$static._optimum[posMem])
          this$static._optimum[posMem].PosPrev = posMem - 1
          if (this$static._optimum[cur].Prev2) {
            this$static._optimum[posMem - 1].Prev1IsChar = 0
            this$static._optimum[posMem - 1].PosPrev =
              this$static._optimum[cur].PosPrev2
            this$static._optimum[posMem - 1].BackPrev =
              this$static._optimum[cur].BackPrev2
          }
        }
        posPrev = posMem
        backCur = backMem
        backMem = this$static._optimum[posPrev].BackPrev
        posMem = this$static._optimum[posPrev].PosPrev
        this$static._optimum[posPrev].BackPrev = backCur
        this$static._optimum[posPrev].PosPrev = cur
        cur = posPrev
      } while (cur > 0)
      this$static.backRes = this$static._optimum[0].BackPrev
      this$static._optimumCurrentIndex = this$static._optimum[0].PosPrev
      return this$static._optimumCurrentIndex
    }

    function $BaseInit(this$static) {
      this$static._state = 0
      this$static._previousByte = 0
      for (var i = 0; i < 4; ++i) {
        this$static._repDistances[i] = 0
      }
    }

    function $CodeOneBlock(this$static, inSize, outSize, finished) {
      var baseVal,
        complexState,
        curByte,
        distance,
        footerBits,
        i,
        len,
        lenToPosState,
        matchByte,
        pos,
        posReduced,
        posSlot,
        posState,
        progressPosValuePrev,
        subCoder
      inSize[0] = P0_longLit
      outSize[0] = P0_longLit
      finished[0] = 1
      if (this$static._inStream) {
        this$static._matchFinder._stream = this$static._inStream
        $Init_5(this$static._matchFinder)
        this$static._needReleaseMFStream = 1
        this$static._inStream = null
      }
      if (this$static._finished) {
        return
      }
      this$static._finished = 1
      progressPosValuePrev = this$static.nowPos64
      if (eq(this$static.nowPos64, P0_longLit)) {
        if (!$GetNumAvailableBytes(this$static._matchFinder)) {
          $Flush(this$static, lowBits_0(this$static.nowPos64))
          return
        }
        $ReadMatchDistances(this$static)
        posState = lowBits_0(this$static.nowPos64) & this$static._posStateMask
        $Encode_3(
          this$static._rangeEncoder,
          this$static._isMatch,
          (this$static._state << 4) + posState,
          0
        )
        this$static._state = StateUpdateChar(this$static._state)
        curByte = $GetIndexByte(
          this$static._matchFinder,
          -this$static._additionalOffset
        )
        $Encode_1(
          $GetSubCoder(
            this$static._literalEncoder,
            lowBits_0(this$static.nowPos64),
            this$static._previousByte
          ),
          this$static._rangeEncoder,
          curByte
        )
        this$static._previousByte = curByte
        --this$static._additionalOffset
        this$static.nowPos64 = add(this$static.nowPos64, P1_longLit)
      }
      if (!$GetNumAvailableBytes(this$static._matchFinder)) {
        $Flush(this$static, lowBits_0(this$static.nowPos64))
        return
      }
      while (1) {
        len = $GetOptimum(this$static, lowBits_0(this$static.nowPos64))
        pos = this$static.backRes
        posState = lowBits_0(this$static.nowPos64) & this$static._posStateMask
        complexState = (this$static._state << 4) + posState
        if (len == 1 && pos == -1) {
          $Encode_3(
            this$static._rangeEncoder,
            this$static._isMatch,
            complexState,
            0
          )
          curByte = $GetIndexByte(
            this$static._matchFinder,
            -this$static._additionalOffset
          )
          subCoder = $GetSubCoder(
            this$static._literalEncoder,
            lowBits_0(this$static.nowPos64),
            this$static._previousByte
          )
          if (this$static._state < 7) {
            $Encode_1(subCoder, this$static._rangeEncoder, curByte)
          } else {
            matchByte = $GetIndexByte(
              this$static._matchFinder,
              -this$static._repDistances[0] - 1 - this$static._additionalOffset
            )
            $EncodeMatched(
              subCoder,
              this$static._rangeEncoder,
              matchByte,
              curByte
            )
          }
          this$static._previousByte = curByte
          this$static._state = StateUpdateChar(this$static._state)
        } else {
          $Encode_3(
            this$static._rangeEncoder,
            this$static._isMatch,
            complexState,
            1
          )
          if (pos < 4) {
            $Encode_3(
              this$static._rangeEncoder,
              this$static._isRep,
              this$static._state,
              1
            )
            if (!pos) {
              $Encode_3(
                this$static._rangeEncoder,
                this$static._isRepG0,
                this$static._state,
                0
              )
              if (len == 1) {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRep0Long,
                  complexState,
                  0
                )
              } else {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRep0Long,
                  complexState,
                  1
                )
              }
            } else {
              $Encode_3(
                this$static._rangeEncoder,
                this$static._isRepG0,
                this$static._state,
                1
              )
              if (pos == 1) {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG1,
                  this$static._state,
                  0
                )
              } else {
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG1,
                  this$static._state,
                  1
                )
                $Encode_3(
                  this$static._rangeEncoder,
                  this$static._isRepG2,
                  this$static._state,
                  pos - 2
                )
              }
            }
            if (len == 1) {
              this$static._state = this$static._state < 7 ? 9 : 11
            } else {
              $Encode_0(
                this$static._repMatchLenEncoder,
                this$static._rangeEncoder,
                len - 2,
                posState
              )
              this$static._state = this$static._state < 7 ? 8 : 11
            }
            distance = this$static._repDistances[pos]
            if (pos != 0) {
              for (i = pos; i >= 1; --i) {
                this$static._repDistances[i] = this$static._repDistances[i - 1]
              }
              this$static._repDistances[0] = distance
            }
          } else {
            $Encode_3(
              this$static._rangeEncoder,
              this$static._isRep,
              this$static._state,
              0
            )
            this$static._state = this$static._state < 7 ? 7 : 10
            $Encode_0(
              this$static._lenEncoder,
              this$static._rangeEncoder,
              len - 2,
              posState
            )
            pos -= 4
            posSlot = GetPosSlot(pos)
            lenToPosState = GetLenToPosState(len)
            $Encode_2(
              this$static._posSlotEncoder[lenToPosState],
              this$static._rangeEncoder,
              posSlot
            )
            if (posSlot >= 4) {
              footerBits = (posSlot >> 1) - 1
              baseVal = (2 | (posSlot & 1)) << footerBits
              posReduced = pos - baseVal
              if (posSlot < 14) {
                ReverseEncode(
                  this$static._posEncoders,
                  baseVal - posSlot - 1,
                  this$static._rangeEncoder,
                  footerBits,
                  posReduced
                )
              } else {
                $EncodeDirectBits(
                  this$static._rangeEncoder,
                  posReduced >> 4,
                  footerBits - 4
                )
                $ReverseEncode(
                  this$static._posAlignEncoder,
                  this$static._rangeEncoder,
                  posReduced & 15
                )
                ++this$static._alignPriceCount
              }
            }
            distance = pos
            for (i = 3; i >= 1; --i) {
              this$static._repDistances[i] = this$static._repDistances[i - 1]
            }
            this$static._repDistances[0] = distance
            ++this$static._matchPriceCount
          }
          this$static._previousByte = $GetIndexByte(
            this$static._matchFinder,
            len - 1 - this$static._additionalOffset
          )
        }
        this$static._additionalOffset -= len
        this$static.nowPos64 = add(this$static.nowPos64, fromInt(len))
        if (!this$static._additionalOffset) {
          if (this$static._matchPriceCount >= 128) {
            $FillDistancesPrices(this$static)
          }
          if (this$static._alignPriceCount >= 16) {
            $FillAlignPrices(this$static)
          }
          inSize[0] = this$static.nowPos64
          outSize[0] = $GetProcessedSizeAdd(this$static._rangeEncoder)
          if (!$GetNumAvailableBytes(this$static._matchFinder)) {
            $Flush(this$static, lowBits_0(this$static.nowPos64))
            return
          }
          if (
            compare(
              sub(this$static.nowPos64, progressPosValuePrev),
              [4096, 0]
            ) >= 0
          ) {
            this$static._finished = 0
            finished[0] = 0
            return
          }
        }
      }
    }

    function $Create_2(this$static) {
      var bt, numHashBytes
      if (!this$static._matchFinder) {
        bt = {}
        numHashBytes = 4
        if (!this$static._matchFinderType) {
          numHashBytes = 2
        }
        $SetType(bt, numHashBytes)
        this$static._matchFinder = bt
      }
      $Create_1(
        this$static._literalEncoder,
        this$static._numLiteralPosStateBits,
        this$static._numLiteralContextBits
      )
      if (
        this$static._dictionarySize == this$static._dictionarySizePrev &&
        this$static._numFastBytesPrev == this$static._numFastBytes
      ) {
        return
      }
      $Create_3(
        this$static._matchFinder,
        this$static._dictionarySize,
        4096,
        this$static._numFastBytes,
        274
      )
      this$static._dictionarySizePrev = this$static._dictionarySize
      this$static._numFastBytesPrev = this$static._numFastBytes
    }

    function $Encoder(this$static) {
      var i
      this$static._repDistances = initDim(4)
      this$static._optimum = []
      this$static._rangeEncoder = {}
      this$static._isMatch = initDim(192)
      this$static._isRep = initDim(12)
      this$static._isRepG0 = initDim(12)
      this$static._isRepG1 = initDim(12)
      this$static._isRepG2 = initDim(12)
      this$static._isRep0Long = initDim(192)
      this$static._posSlotEncoder = []
      this$static._posEncoders = initDim(114)
      this$static._posAlignEncoder = $BitTreeEncoder({}, 4)
      this$static._lenEncoder = $Encoder$LenPriceTableEncoder({})
      this$static._repMatchLenEncoder = $Encoder$LenPriceTableEncoder({})
      this$static._literalEncoder = {}
      this$static._matchDistances = []
      this$static._posSlotPrices = []
      this$static._distancesPrices = []
      this$static._alignPrices = initDim(16)
      this$static.reps = initDim(4)
      this$static.repLens = initDim(4)
      this$static.processedInSize = [P0_longLit]
      this$static.processedOutSize = [P0_longLit]
      this$static.finished = [0]
      this$static.properties = initDim(5)
      this$static.tempPrices = initDim(128)
      this$static._longestMatchLength = 0
      this$static._matchFinderType = 1
      this$static._numDistancePairs = 0
      this$static._numFastBytesPrev = -1
      this$static.backRes = 0
      for (i = 0; i < 4096; ++i) {
        this$static._optimum[i] = {}
      }
      for (i = 0; i < 4; ++i) {
        this$static._posSlotEncoder[i] = $BitTreeEncoder({}, 6)
      }
      return this$static
    }

    function $FillAlignPrices(this$static) {
      for (var i = 0; i < 16; ++i) {
        this$static._alignPrices[i] = $ReverseGetPrice(
          this$static._posAlignEncoder,
          i
        )
      }
      this$static._alignPriceCount = 0
    }

    function $FillDistancesPrices(this$static) {
      var baseVal, encoder, footerBits, i, lenToPosState, posSlot, st, st2
      for (i = 4; i < 128; ++i) {
        posSlot = GetPosSlot(i)
        footerBits = (posSlot >> 1) - 1
        baseVal = (2 | (posSlot & 1)) << footerBits
        this$static.tempPrices[i] = ReverseGetPrice(
          this$static._posEncoders,
          baseVal - posSlot - 1,
          footerBits,
          i - baseVal
        )
      }
      for (lenToPosState = 0; lenToPosState < 4; ++lenToPosState) {
        encoder = this$static._posSlotEncoder[lenToPosState]
        st = lenToPosState << 6
        for (posSlot = 0; posSlot < this$static._distTableSize; ++posSlot) {
          this$static._posSlotPrices[st + posSlot] = $GetPrice_1(
            encoder,
            posSlot
          )
        }
        for (posSlot = 14; posSlot < this$static._distTableSize; ++posSlot) {
          this$static._posSlotPrices[st + posSlot] +=
            ((posSlot >> 1) - 1 - 4) << 6
        }
        st2 = lenToPosState * 128
        for (i = 0; i < 4; ++i) {
          this$static._distancesPrices[st2 + i] =
            this$static._posSlotPrices[st + i]
        }
        for (; i < 128; ++i) {
          this$static._distancesPrices[st2 + i] =
            this$static._posSlotPrices[st + GetPosSlot(i)] +
            this$static.tempPrices[i]
        }
      }
      this$static._matchPriceCount = 0
    }

    function $Flush(this$static, nowPos) {
      $ReleaseMFStream(this$static)
      $WriteEndMarker(this$static, nowPos & this$static._posStateMask)
      for (var i = 0; i < 5; ++i) {
        $ShiftLow(this$static._rangeEncoder)
      }
    }

    function $GetOptimum(this$static, position) {
      var cur,
        curAnd1Price,
        curAndLenCharPrice,
        curAndLenPrice,
        curBack,
        curPrice,
        currentByte,
        distance,
        i,
        len,
        lenEnd,
        lenMain,
        lenRes,
        lenTest,
        lenTest2,
        lenTestTemp,
        matchByte,
        matchPrice,
        newLen,
        nextIsChar,
        nextMatchPrice,
        nextOptimum,
        nextRepMatchPrice,
        normalMatchPrice,
        numAvailableBytes,
        numAvailableBytesFull,
        numDistancePairs,
        offs,
        offset,
        opt,
        optimum,
        pos,
        posPrev,
        posState,
        posStateNext,
        price_4,
        repIndex,
        repLen,
        repMatchPrice,
        repMaxIndex,
        shortRepPrice,
        startLen,
        state,
        state2,
        t,
        price,
        price_0,
        price_1,
        price_2,
        price_3
      if (this$static._optimumEndIndex != this$static._optimumCurrentIndex) {
        lenRes =
          this$static._optimum[this$static._optimumCurrentIndex].PosPrev -
          this$static._optimumCurrentIndex
        this$static.backRes =
          this$static._optimum[this$static._optimumCurrentIndex].BackPrev
        this$static._optimumCurrentIndex =
          this$static._optimum[this$static._optimumCurrentIndex].PosPrev
        return lenRes
      }
      this$static._optimumCurrentIndex = this$static._optimumEndIndex = 0
      if (this$static._longestMatchWasFound) {
        lenMain = this$static._longestMatchLength
        this$static._longestMatchWasFound = 0
      } else {
        lenMain = $ReadMatchDistances(this$static)
      }
      numDistancePairs = this$static._numDistancePairs
      numAvailableBytes = $GetNumAvailableBytes(this$static._matchFinder) + 1
      if (numAvailableBytes < 2) {
        this$static.backRes = -1
        return 1
      }
      if (numAvailableBytes > 273) {
        numAvailableBytes = 273
      }
      repMaxIndex = 0
      for (i = 0; i < 4; ++i) {
        this$static.reps[i] = this$static._repDistances[i]
        this$static.repLens[i] = $GetMatchLen(
          this$static._matchFinder,
          -1,
          this$static.reps[i],
          273
        )
        if (this$static.repLens[i] > this$static.repLens[repMaxIndex]) {
          repMaxIndex = i
        }
      }
      if (this$static.repLens[repMaxIndex] >= this$static._numFastBytes) {
        this$static.backRes = repMaxIndex
        lenRes = this$static.repLens[repMaxIndex]
        $MovePos(this$static, lenRes - 1)
        return lenRes
      }
      if (lenMain >= this$static._numFastBytes) {
        this$static.backRes =
          this$static._matchDistances[numDistancePairs - 1] + 4
        $MovePos(this$static, lenMain - 1)
        return lenMain
      }
      currentByte = $GetIndexByte(this$static._matchFinder, -1)
      matchByte = $GetIndexByte(
        this$static._matchFinder,
        -this$static._repDistances[0] - 1 - 1
      )
      if (
        lenMain < 2 &&
        currentByte != matchByte &&
        this$static.repLens[repMaxIndex] < 2
      ) {
        this$static.backRes = -1
        return 1
      }
      this$static._optimum[0].State = this$static._state
      posState = position & this$static._posStateMask
      this$static._optimum[1].Price =
        ProbPrices[
          this$static._isMatch[(this$static._state << 4) + posState] >>> 2
        ] +
        $GetPrice_0(
          $GetSubCoder(
            this$static._literalEncoder,
            position,
            this$static._previousByte
          ),
          this$static._state >= 7,
          matchByte,
          currentByte
        )
      $MakeAsChar(this$static._optimum[1])
      matchPrice =
        ProbPrices[
          (2048 -
            this$static._isMatch[(this$static._state << 4) + posState]) >>>
            2
        ]
      repMatchPrice =
        matchPrice +
        ProbPrices[(2048 - this$static._isRep[this$static._state]) >>> 2]
      if (matchByte == currentByte) {
        shortRepPrice =
          repMatchPrice +
          $GetRepLen1Price(this$static, this$static._state, posState)
        if (shortRepPrice < this$static._optimum[1].Price) {
          this$static._optimum[1].Price = shortRepPrice
          $MakeAsShortRep(this$static._optimum[1])
        }
      }
      lenEnd =
        lenMain >= this$static.repLens[repMaxIndex]
          ? lenMain
          : this$static.repLens[repMaxIndex]
      if (lenEnd < 2) {
        this$static.backRes = this$static._optimum[1].BackPrev
        return 1
      }
      this$static._optimum[1].PosPrev = 0
      this$static._optimum[0].Backs0 = this$static.reps[0]
      this$static._optimum[0].Backs1 = this$static.reps[1]
      this$static._optimum[0].Backs2 = this$static.reps[2]
      this$static._optimum[0].Backs3 = this$static.reps[3]
      len = lenEnd
      do {
        this$static._optimum[len--].Price = 268435455
      } while (len >= 2)
      for (i = 0; i < 4; ++i) {
        repLen = this$static.repLens[i]
        if (repLen < 2) {
          continue
        }
        price_4 =
          repMatchPrice +
          $GetPureRepPrice(this$static, i, this$static._state, posState)
        do {
          curAndLenPrice =
            price_4 +
            $GetPrice(this$static._repMatchLenEncoder, repLen - 2, posState)
          optimum = this$static._optimum[repLen]
          if (curAndLenPrice < optimum.Price) {
            optimum.Price = curAndLenPrice
            optimum.PosPrev = 0
            optimum.BackPrev = i
            optimum.Prev1IsChar = 0
          }
        } while (--repLen >= 2)
      }
      normalMatchPrice =
        matchPrice + ProbPrices[this$static._isRep[this$static._state] >>> 2]
      len = this$static.repLens[0] >= 2 ? this$static.repLens[0] + 1 : 2
      if (len <= lenMain) {
        offs = 0
        while (len > this$static._matchDistances[offs]) {
          offs += 2
        }
        for (; ; ++len) {
          distance = this$static._matchDistances[offs + 1]
          curAndLenPrice =
            normalMatchPrice +
            $GetPosLenPrice(this$static, distance, len, posState)
          optimum = this$static._optimum[len]
          if (curAndLenPrice < optimum.Price) {
            optimum.Price = curAndLenPrice
            optimum.PosPrev = 0
            optimum.BackPrev = distance + 4
            optimum.Prev1IsChar = 0
          }
          if (len == this$static._matchDistances[offs]) {
            offs += 2
            if (offs == numDistancePairs) {
              break
            }
          }
        }
      }
      cur = 0
      while (1) {
        ++cur
        if (cur == lenEnd) {
          return $Backward(this$static, cur)
        }
        newLen = $ReadMatchDistances(this$static)
        numDistancePairs = this$static._numDistancePairs
        if (newLen >= this$static._numFastBytes) {
          this$static._longestMatchLength = newLen
          this$static._longestMatchWasFound = 1
          return $Backward(this$static, cur)
        }
        ++position
        posPrev = this$static._optimum[cur].PosPrev
        if (this$static._optimum[cur].Prev1IsChar) {
          --posPrev
          if (this$static._optimum[cur].Prev2) {
            state =
              this$static._optimum[this$static._optimum[cur].PosPrev2].State
            if (this$static._optimum[cur].BackPrev2 < 4) {
              state = state < 7 ? 8 : 11
            } else {
              state = state < 7 ? 7 : 10
            }
          } else {
            state = this$static._optimum[posPrev].State
          }
          state = StateUpdateChar(state)
        } else {
          state = this$static._optimum[posPrev].State
        }
        if (posPrev == cur - 1) {
          if (!this$static._optimum[cur].BackPrev) {
            state = state < 7 ? 9 : 11
          } else {
            state = StateUpdateChar(state)
          }
        } else {
          if (
            this$static._optimum[cur].Prev1IsChar &&
            this$static._optimum[cur].Prev2
          ) {
            posPrev = this$static._optimum[cur].PosPrev2
            pos = this$static._optimum[cur].BackPrev2
            state = state < 7 ? 8 : 11
          } else {
            pos = this$static._optimum[cur].BackPrev
            if (pos < 4) {
              state = state < 7 ? 8 : 11
            } else {
              state = state < 7 ? 7 : 10
            }
          }
          opt = this$static._optimum[posPrev]
          if (pos < 4) {
            if (!pos) {
              this$static.reps[0] = opt.Backs0
              this$static.reps[1] = opt.Backs1
              this$static.reps[2] = opt.Backs2
              this$static.reps[3] = opt.Backs3
            } else if (pos == 1) {
              this$static.reps[0] = opt.Backs1
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs2
              this$static.reps[3] = opt.Backs3
            } else if (pos == 2) {
              this$static.reps[0] = opt.Backs2
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs1
              this$static.reps[3] = opt.Backs3
            } else {
              this$static.reps[0] = opt.Backs3
              this$static.reps[1] = opt.Backs0
              this$static.reps[2] = opt.Backs1
              this$static.reps[3] = opt.Backs2
            }
          } else {
            this$static.reps[0] = pos - 4
            this$static.reps[1] = opt.Backs0
            this$static.reps[2] = opt.Backs1
            this$static.reps[3] = opt.Backs2
          }
        }
        this$static._optimum[cur].State = state
        this$static._optimum[cur].Backs0 = this$static.reps[0]
        this$static._optimum[cur].Backs1 = this$static.reps[1]
        this$static._optimum[cur].Backs2 = this$static.reps[2]
        this$static._optimum[cur].Backs3 = this$static.reps[3]
        curPrice = this$static._optimum[cur].Price
        currentByte = $GetIndexByte(this$static._matchFinder, -1)
        matchByte = $GetIndexByte(
          this$static._matchFinder,
          -this$static.reps[0] - 1 - 1
        )
        posState = position & this$static._posStateMask
        curAnd1Price =
          curPrice +
          ProbPrices[this$static._isMatch[(state << 4) + posState] >>> 2] +
          $GetPrice_0(
            $GetSubCoder(
              this$static._literalEncoder,
              position,
              $GetIndexByte(this$static._matchFinder, -2)
            ),
            state >= 7,
            matchByte,
            currentByte
          )
        nextOptimum = this$static._optimum[cur + 1]
        nextIsChar = 0
        if (curAnd1Price < nextOptimum.Price) {
          nextOptimum.Price = curAnd1Price
          nextOptimum.PosPrev = cur
          nextOptimum.BackPrev = -1
          nextOptimum.Prev1IsChar = 0
          nextIsChar = 1
        }
        matchPrice =
          curPrice +
          ProbPrices[
            (2048 - this$static._isMatch[(state << 4) + posState]) >>> 2
          ]
        repMatchPrice =
          matchPrice + ProbPrices[(2048 - this$static._isRep[state]) >>> 2]
        if (
          matchByte == currentByte &&
          !(nextOptimum.PosPrev < cur && !nextOptimum.BackPrev)
        ) {
          shortRepPrice =
            repMatchPrice +
            (ProbPrices[this$static._isRepG0[state] >>> 2] +
              ProbPrices[
                this$static._isRep0Long[(state << 4) + posState] >>> 2
              ])
          if (shortRepPrice <= nextOptimum.Price) {
            nextOptimum.Price = shortRepPrice
            nextOptimum.PosPrev = cur
            nextOptimum.BackPrev = 0
            nextOptimum.Prev1IsChar = 0
            nextIsChar = 1
          }
        }
        numAvailableBytesFull =
          $GetNumAvailableBytes(this$static._matchFinder) + 1
        numAvailableBytesFull =
          4095 - cur < numAvailableBytesFull
            ? 4095 - cur
            : numAvailableBytesFull
        numAvailableBytes = numAvailableBytesFull
        if (numAvailableBytes < 2) {
          continue
        }
        if (numAvailableBytes > this$static._numFastBytes) {
          numAvailableBytes = this$static._numFastBytes
        }
        if (!nextIsChar && matchByte != currentByte) {
          t = Math.min(numAvailableBytesFull - 1, this$static._numFastBytes)
          lenTest2 = $GetMatchLen(
            this$static._matchFinder,
            0,
            this$static.reps[0],
            t
          )
          if (lenTest2 >= 2) {
            state2 = StateUpdateChar(state)
            posStateNext = (position + 1) & this$static._posStateMask
            nextRepMatchPrice =
              curAnd1Price +
              ProbPrices[
                (2048 - this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                  2
              ] +
              ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
            offset = cur + 1 + lenTest2
            while (lenEnd < offset) {
              this$static._optimum[++lenEnd].Price = 268435455
            }
            curAndLenPrice =
              nextRepMatchPrice +
              ((price = $GetPrice(
                this$static._repMatchLenEncoder,
                lenTest2 - 2,
                posStateNext
              )),
              price + $GetPureRepPrice(this$static, 0, state2, posStateNext))
            optimum = this$static._optimum[offset]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur + 1
              optimum.BackPrev = 0
              optimum.Prev1IsChar = 1
              optimum.Prev2 = 0
            }
          }
        }
        startLen = 2
        for (repIndex = 0; repIndex < 4; ++repIndex) {
          lenTest = $GetMatchLen(
            this$static._matchFinder,
            -1,
            this$static.reps[repIndex],
            numAvailableBytes
          )
          if (lenTest < 2) {
            continue
          }
          lenTestTemp = lenTest
          do {
            while (lenEnd < cur + lenTest) {
              this$static._optimum[++lenEnd].Price = 268435455
            }
            curAndLenPrice =
              repMatchPrice +
              ((price_0 = $GetPrice(
                this$static._repMatchLenEncoder,
                lenTest - 2,
                posState
              )),
              price_0 +
                $GetPureRepPrice(this$static, repIndex, state, posState))
            optimum = this$static._optimum[cur + lenTest]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur
              optimum.BackPrev = repIndex
              optimum.Prev1IsChar = 0
            }
          } while (--lenTest >= 2)
          lenTest = lenTestTemp
          if (!repIndex) {
            startLen = lenTest + 1
          }
          if (lenTest < numAvailableBytesFull) {
            t = Math.min(
              numAvailableBytesFull - 1 - lenTest,
              this$static._numFastBytes
            )
            lenTest2 = $GetMatchLen(
              this$static._matchFinder,
              lenTest,
              this$static.reps[repIndex],
              t
            )
            if (lenTest2 >= 2) {
              state2 = state < 7 ? 8 : 11
              posStateNext = (position + lenTest) & this$static._posStateMask
              curAndLenCharPrice =
                repMatchPrice +
                ((price_1 = $GetPrice(
                  this$static._repMatchLenEncoder,
                  lenTest - 2,
                  posState
                )),
                price_1 +
                  $GetPureRepPrice(this$static, repIndex, state, posState)) +
                ProbPrices[
                  this$static._isMatch[(state2 << 4) + posStateNext] >>> 2
                ] +
                $GetPrice_0(
                  $GetSubCoder(
                    this$static._literalEncoder,
                    position + lenTest,
                    $GetIndexByte(this$static._matchFinder, lenTest - 1 - 1)
                  ),
                  1,
                  $GetIndexByte(
                    this$static._matchFinder,
                    lenTest - 1 - (this$static.reps[repIndex] + 1)
                  ),
                  $GetIndexByte(this$static._matchFinder, lenTest - 1)
                )
              state2 = StateUpdateChar(state2)
              posStateNext =
                (position + lenTest + 1) & this$static._posStateMask
              nextMatchPrice =
                curAndLenCharPrice +
                ProbPrices[
                  (2048 -
                    this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                    2
                ]
              nextRepMatchPrice =
                nextMatchPrice +
                ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
              offset = lenTest + 1 + lenTest2
              while (lenEnd < cur + offset) {
                this$static._optimum[++lenEnd].Price = 268435455
              }
              curAndLenPrice =
                nextRepMatchPrice +
                ((price_2 = $GetPrice(
                  this$static._repMatchLenEncoder,
                  lenTest2 - 2,
                  posStateNext
                )),
                price_2 +
                  $GetPureRepPrice(this$static, 0, state2, posStateNext))
              optimum = this$static._optimum[cur + offset]
              if (curAndLenPrice < optimum.Price) {
                optimum.Price = curAndLenPrice
                optimum.PosPrev = cur + lenTest + 1
                optimum.BackPrev = 0
                optimum.Prev1IsChar = 1
                optimum.Prev2 = 1
                optimum.PosPrev2 = cur
                optimum.BackPrev2 = repIndex
              }
            }
          }
        }
        if (newLen > numAvailableBytes) {
          newLen = numAvailableBytes
          for (
            numDistancePairs = 0;
            newLen > this$static._matchDistances[numDistancePairs];
            numDistancePairs += 2
          ) {}
          this$static._matchDistances[numDistancePairs] = newLen
          numDistancePairs += 2
        }
        if (newLen >= startLen) {
          normalMatchPrice =
            matchPrice + ProbPrices[this$static._isRep[state] >>> 2]
          while (lenEnd < cur + newLen) {
            this$static._optimum[++lenEnd].Price = 268435455
          }
          offs = 0
          while (startLen > this$static._matchDistances[offs]) {
            offs += 2
          }
          for (lenTest = startLen; ; ++lenTest) {
            curBack = this$static._matchDistances[offs + 1]
            curAndLenPrice =
              normalMatchPrice +
              $GetPosLenPrice(this$static, curBack, lenTest, posState)
            optimum = this$static._optimum[cur + lenTest]
            if (curAndLenPrice < optimum.Price) {
              optimum.Price = curAndLenPrice
              optimum.PosPrev = cur
              optimum.BackPrev = curBack + 4
              optimum.Prev1IsChar = 0
            }
            if (lenTest == this$static._matchDistances[offs]) {
              if (lenTest < numAvailableBytesFull) {
                t = Math.min(
                  numAvailableBytesFull - 1 - lenTest,
                  this$static._numFastBytes
                )
                lenTest2 = $GetMatchLen(
                  this$static._matchFinder,
                  lenTest,
                  curBack,
                  t
                )
                if (lenTest2 >= 2) {
                  state2 = state < 7 ? 7 : 10
                  posStateNext =
                    (position + lenTest) & this$static._posStateMask
                  curAndLenCharPrice =
                    curAndLenPrice +
                    ProbPrices[
                      this$static._isMatch[(state2 << 4) + posStateNext] >>> 2
                    ] +
                    $GetPrice_0(
                      $GetSubCoder(
                        this$static._literalEncoder,
                        position + lenTest,
                        $GetIndexByte(this$static._matchFinder, lenTest - 1 - 1)
                      ),
                      1,
                      $GetIndexByte(
                        this$static._matchFinder,
                        lenTest - (curBack + 1) - 1
                      ),
                      $GetIndexByte(this$static._matchFinder, lenTest - 1)
                    )
                  state2 = StateUpdateChar(state2)
                  posStateNext =
                    (position + lenTest + 1) & this$static._posStateMask
                  nextMatchPrice =
                    curAndLenCharPrice +
                    ProbPrices[
                      (2048 -
                        this$static._isMatch[(state2 << 4) + posStateNext]) >>>
                        2
                    ]
                  nextRepMatchPrice =
                    nextMatchPrice +
                    ProbPrices[(2048 - this$static._isRep[state2]) >>> 2]
                  offset = lenTest + 1 + lenTest2
                  while (lenEnd < cur + offset) {
                    this$static._optimum[++lenEnd].Price = 268435455
                  }
                  curAndLenPrice =
                    nextRepMatchPrice +
                    ((price_3 = $GetPrice(
                      this$static._repMatchLenEncoder,
                      lenTest2 - 2,
                      posStateNext
                    )),
                    price_3 +
                      $GetPureRepPrice(this$static, 0, state2, posStateNext))
                  optimum = this$static._optimum[cur + offset]
                  if (curAndLenPrice < optimum.Price) {
                    optimum.Price = curAndLenPrice
                    optimum.PosPrev = cur + lenTest + 1
                    optimum.BackPrev = 0
                    optimum.Prev1IsChar = 1
                    optimum.Prev2 = 1
                    optimum.PosPrev2 = cur
                    optimum.BackPrev2 = curBack + 4
                  }
                }
              }
              offs += 2
              if (offs == numDistancePairs) break
            }
          }
        }
      }
    }

    function $GetPosLenPrice(this$static, pos, len, posState) {
      var price,
        lenToPosState = GetLenToPosState(len)
      if (pos < 128) {
        price = this$static._distancesPrices[lenToPosState * 128 + pos]
      } else {
        price =
          this$static._posSlotPrices[(lenToPosState << 6) + GetPosSlot2(pos)] +
          this$static._alignPrices[pos & 15]
      }
      return price + $GetPrice(this$static._lenEncoder, len - 2, posState)
    }

    function $GetPureRepPrice(this$static, repIndex, state, posState) {
      var price
      if (!repIndex) {
        price = ProbPrices[this$static._isRepG0[state] >>> 2]
        price +=
          ProbPrices[
            (2048 - this$static._isRep0Long[(state << 4) + posState]) >>> 2
          ]
      } else {
        price = ProbPrices[(2048 - this$static._isRepG0[state]) >>> 2]
        if (repIndex == 1) {
          price += ProbPrices[this$static._isRepG1[state] >>> 2]
        } else {
          price += ProbPrices[(2048 - this$static._isRepG1[state]) >>> 2]
          price += GetPrice(this$static._isRepG2[state], repIndex - 2)
        }
      }
      return price
    }

    function $GetRepLen1Price(this$static, state, posState) {
      return (
        ProbPrices[this$static._isRepG0[state] >>> 2] +
        ProbPrices[this$static._isRep0Long[(state << 4) + posState] >>> 2]
      )
    }

    function $Init_4(this$static) {
      $BaseInit(this$static)
      $Init_9(this$static._rangeEncoder)
      InitBitModels(this$static._isMatch)
      InitBitModels(this$static._isRep0Long)
      InitBitModels(this$static._isRep)
      InitBitModels(this$static._isRepG0)
      InitBitModels(this$static._isRepG1)
      InitBitModels(this$static._isRepG2)
      InitBitModels(this$static._posEncoders)
      $Init_3(this$static._literalEncoder)
      for (var i = 0; i < 4; ++i) {
        InitBitModels(this$static._posSlotEncoder[i].Models)
      }
      $Init_2(this$static._lenEncoder, 1 << this$static._posStateBits)
      $Init_2(this$static._repMatchLenEncoder, 1 << this$static._posStateBits)
      InitBitModels(this$static._posAlignEncoder.Models)
      this$static._longestMatchWasFound = 0
      this$static._optimumEndIndex = 0
      this$static._optimumCurrentIndex = 0
      this$static._additionalOffset = 0
    }

    function $MovePos(this$static, num) {
      if (num > 0) {
        $Skip(this$static._matchFinder, num)
        this$static._additionalOffset += num
      }
    }

    function $ReadMatchDistances(this$static) {
      var lenRes = 0
      this$static._numDistancePairs = $GetMatches(
        this$static._matchFinder,
        this$static._matchDistances
      )
      if (this$static._numDistancePairs > 0) {
        lenRes = this$static._matchDistances[this$static._numDistancePairs - 2]
        if (lenRes == this$static._numFastBytes)
          lenRes += $GetMatchLen(
            this$static._matchFinder,
            lenRes - 1,
            this$static._matchDistances[this$static._numDistancePairs - 1],
            273 - lenRes
          )
      }
      ++this$static._additionalOffset
      return lenRes
    }

    function $ReleaseMFStream(this$static) {
      if (this$static._matchFinder && this$static._needReleaseMFStream) {
        this$static._matchFinder._stream = null
        this$static._needReleaseMFStream = 0
      }
    }

    function $ReleaseStreams(this$static) {
      $ReleaseMFStream(this$static)
      this$static._rangeEncoder.Stream = null
    }

    function $SetDictionarySize_0(this$static, dictionarySize) {
      this$static._dictionarySize = dictionarySize
      for (
        var dicLogSize = 0;
        dictionarySize > 1 << dicLogSize;
        ++dicLogSize
      ) {}
      this$static._distTableSize = dicLogSize * 2
    }

    function $SetMatchFinder(this$static, matchFinderIndex) {
      var matchFinderIndexPrev = this$static._matchFinderType
      this$static._matchFinderType = matchFinderIndex
      if (
        this$static._matchFinder &&
        matchFinderIndexPrev != this$static._matchFinderType
      ) {
        this$static._dictionarySizePrev = -1
        this$static._matchFinder = null
      }
    }

    function $WriteCoderProperties(this$static, outStream) {
      this$static.properties[0] =
        (((this$static._posStateBits * 5 +
          this$static._numLiteralPosStateBits) *
          9 +
          this$static._numLiteralContextBits) <<
          24) >>
        24
      for (var i = 0; i < 4; ++i) {
        this$static.properties[1 + i] =
          ((this$static._dictionarySize >> (8 * i)) << 24) >> 24
      }
      $write_0(outStream, this$static.properties, 0, 5)
    }

    function $WriteEndMarker(this$static, posState) {
      if (!this$static._writeEndMark) {
        return
      }
      $Encode_3(
        this$static._rangeEncoder,
        this$static._isMatch,
        (this$static._state << 4) + posState,
        1
      )
      $Encode_3(
        this$static._rangeEncoder,
        this$static._isRep,
        this$static._state,
        0
      )
      this$static._state = this$static._state < 7 ? 7 : 10
      $Encode_0(this$static._lenEncoder, this$static._rangeEncoder, 0, posState)
      var lenToPosState = GetLenToPosState(2)
      $Encode_2(
        this$static._posSlotEncoder[lenToPosState],
        this$static._rangeEncoder,
        63
      )
      $EncodeDirectBits(this$static._rangeEncoder, 67108863, 26)
      $ReverseEncode(
        this$static._posAlignEncoder,
        this$static._rangeEncoder,
        15
      )
    }

    function GetPosSlot(pos) {
      if (pos < 2048) {
        return g_FastPos[pos]
      }
      if (pos < 2097152) {
        return g_FastPos[pos >> 10] + 20
      }
      return g_FastPos[pos >> 20] + 40
    }

    function GetPosSlot2(pos) {
      if (pos < 131072) {
        return g_FastPos[pos >> 6] + 12
      }
      if (pos < 134217728) {
        return g_FastPos[pos >> 16] + 32
      }
      return g_FastPos[pos >> 26] + 52
    }

    function $Encode(this$static, rangeEncoder, symbol, posState) {
      if (symbol < 8) {
        $Encode_3(rangeEncoder, this$static._choice, 0, 0)
        $Encode_2(this$static._lowCoder[posState], rangeEncoder, symbol)
      } else {
        symbol -= 8
        $Encode_3(rangeEncoder, this$static._choice, 0, 1)
        if (symbol < 8) {
          $Encode_3(rangeEncoder, this$static._choice, 1, 0)
          $Encode_2(this$static._midCoder[posState], rangeEncoder, symbol)
        } else {
          $Encode_3(rangeEncoder, this$static._choice, 1, 1)
          $Encode_2(this$static._highCoder, rangeEncoder, symbol - 8)
        }
      }
    }

    function $Encoder$LenEncoder(this$static) {
      this$static._choice = initDim(2)
      this$static._lowCoder = initDim(16)
      this$static._midCoder = initDim(16)
      this$static._highCoder = $BitTreeEncoder({}, 8)
      for (var posState = 0; posState < 16; ++posState) {
        this$static._lowCoder[posState] = $BitTreeEncoder({}, 3)
        this$static._midCoder[posState] = $BitTreeEncoder({}, 3)
      }
      return this$static
    }

    function $Init_2(this$static, numPosStates) {
      InitBitModels(this$static._choice)
      for (var posState = 0; posState < numPosStates; ++posState) {
        InitBitModels(this$static._lowCoder[posState].Models)
        InitBitModels(this$static._midCoder[posState].Models)
      }
      InitBitModels(this$static._highCoder.Models)
    }

    function $SetPrices(this$static, posState, numSymbols, prices, st) {
      var a0, a1, b0, b1, i
      a0 = ProbPrices[this$static._choice[0] >>> 2]
      a1 = ProbPrices[(2048 - this$static._choice[0]) >>> 2]
      b0 = a1 + ProbPrices[this$static._choice[1] >>> 2]
      b1 = a1 + ProbPrices[(2048 - this$static._choice[1]) >>> 2]
      i = 0
      for (i = 0; i < 8; ++i) {
        if (i >= numSymbols) return
        prices[st + i] = a0 + $GetPrice_1(this$static._lowCoder[posState], i)
      }
      for (; i < 16; ++i) {
        if (i >= numSymbols) return
        prices[st + i] =
          b0 + $GetPrice_1(this$static._midCoder[posState], i - 8)
      }
      for (; i < numSymbols; ++i) {
        prices[st + i] = b1 + $GetPrice_1(this$static._highCoder, i - 8 - 8)
      }
    }

    function $Encode_0(this$static, rangeEncoder, symbol, posState) {
      $Encode(this$static, rangeEncoder, symbol, posState)
      if (--this$static._counters[posState] == 0) {
        $SetPrices(
          this$static,
          posState,
          this$static._tableSize,
          this$static._prices,
          posState * 272
        )
        this$static._counters[posState] = this$static._tableSize
      }
    }

    function $Encoder$LenPriceTableEncoder(this$static) {
      $Encoder$LenEncoder(this$static)
      this$static._prices = []
      this$static._counters = []
      return this$static
    }

    function $GetPrice(this$static, symbol, posState) {
      return this$static._prices[posState * 272 + symbol]
    }

    function $UpdateTables(this$static, numPosStates) {
      for (var posState = 0; posState < numPosStates; ++posState) {
        $SetPrices(
          this$static,
          posState,
          this$static._tableSize,
          this$static._prices,
          posState * 272
        )
        this$static._counters[posState] = this$static._tableSize
      }
    }

    function $Create_1(this$static, numPosBits, numPrevBits) {
      var i, numStates
      if (
        this$static.m_Coders != null &&
        this$static.m_NumPrevBits == numPrevBits &&
        this$static.m_NumPosBits == numPosBits
      ) {
        return
      }
      this$static.m_NumPosBits = numPosBits
      this$static.m_PosMask = (1 << numPosBits) - 1
      this$static.m_NumPrevBits = numPrevBits
      numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      this$static.m_Coders = initDim(numStates)
      for (i = 0; i < numStates; ++i) {
        this$static.m_Coders[i] = $Encoder$LiteralEncoder$Encoder2({})
      }
    }

    function $GetSubCoder(this$static, pos, prevByte) {
      return this$static.m_Coders[
        ((pos & this$static.m_PosMask) << this$static.m_NumPrevBits) +
          ((prevByte & 255) >>> (8 - this$static.m_NumPrevBits))
      ]
    }

    function $Init_3(this$static) {
      var i,
        numStates = 1 << (this$static.m_NumPrevBits + this$static.m_NumPosBits)
      for (i = 0; i < numStates; ++i) {
        InitBitModels(this$static.m_Coders[i].m_Encoders)
      }
    }

    function $Encode_1(this$static, rangeEncoder, symbol) {
      var bit,
        i,
        context = 1
      for (i = 7; i >= 0; --i) {
        bit = (symbol >> i) & 1
        $Encode_3(rangeEncoder, this$static.m_Encoders, context, bit)
        context = (context << 1) | bit
      }
    }

    function $EncodeMatched(this$static, rangeEncoder, matchByte, symbol) {
      var bit,
        i,
        matchBit,
        state,
        same = 1,
        context = 1
      for (i = 7; i >= 0; --i) {
        bit = (symbol >> i) & 1
        state = context
        if (same) {
          matchBit = (matchByte >> i) & 1
          state += (1 + matchBit) << 8
          same = matchBit == bit
        }
        $Encode_3(rangeEncoder, this$static.m_Encoders, state, bit)
        context = (context << 1) | bit
      }
    }

    function $Encoder$LiteralEncoder$Encoder2(this$static) {
      this$static.m_Encoders = initDim(768)
      return this$static
    }

    function $GetPrice_0(this$static, matchMode, matchByte, symbol) {
      var bit,
        context = 1,
        i = 7,
        matchBit,
        price = 0
      if (matchMode) {
        for (; i >= 0; --i) {
          matchBit = (matchByte >> i) & 1
          bit = (symbol >> i) & 1
          price += GetPrice(
            this$static.m_Encoders[((1 + matchBit) << 8) + context],
            bit
          )
          context = (context << 1) | bit
          if (matchBit != bit) {
            --i
            break
          }
        }
      }
      for (; i >= 0; --i) {
        bit = (symbol >> i) & 1
        price += GetPrice(this$static.m_Encoders[context], bit)
        context = (context << 1) | bit
      }
      return price
    }

    function $MakeAsChar(this$static) {
      this$static.BackPrev = -1
      this$static.Prev1IsChar = 0
    }

    function $MakeAsShortRep(this$static) {
      this$static.BackPrev = 0
      this$static.Prev1IsChar = 0
    }
    /** ce */
    /** ds */
    function $BitTreeDecoder(this$static, numBitLevels) {
      this$static.NumBitLevels = numBitLevels
      this$static.Models = initDim(1 << numBitLevels)
      return this$static
    }

    function $Decode_0(this$static, rangeDecoder) {
      var bitIndex,
        m = 1
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; --bitIndex) {
        m = (m << 1) + $DecodeBit(rangeDecoder, this$static.Models, m)
      }
      return m - (1 << this$static.NumBitLevels)
    }

    function $ReverseDecode(this$static, rangeDecoder) {
      var bit,
        bitIndex,
        m = 1,
        symbol = 0
      for (bitIndex = 0; bitIndex < this$static.NumBitLevels; ++bitIndex) {
        bit = $DecodeBit(rangeDecoder, this$static.Models, m)
        m <<= 1
        m += bit
        symbol |= bit << bitIndex
      }
      return symbol
    }

    function ReverseDecode(Models, startIndex, rangeDecoder, NumBitLevels) {
      var bit,
        bitIndex,
        m = 1,
        symbol = 0
      for (bitIndex = 0; bitIndex < NumBitLevels; ++bitIndex) {
        bit = $DecodeBit(rangeDecoder, Models, startIndex + m)
        m <<= 1
        m += bit
        symbol |= bit << bitIndex
      }
      return symbol
    }
    /** de */
    /** cs */
    function $BitTreeEncoder(this$static, numBitLevels) {
      this$static.NumBitLevels = numBitLevels
      this$static.Models = initDim(1 << numBitLevels)
      return this$static
    }

    function $Encode_2(this$static, rangeEncoder, symbol) {
      var bit,
        bitIndex,
        m = 1
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; ) {
        --bitIndex
        bit = (symbol >>> bitIndex) & 1
        $Encode_3(rangeEncoder, this$static.Models, m, bit)
        m = (m << 1) | bit
      }
    }

    function $GetPrice_1(this$static, symbol) {
      var bit,
        bitIndex,
        m = 1,
        price = 0
      for (bitIndex = this$static.NumBitLevels; bitIndex != 0; ) {
        --bitIndex
        bit = (symbol >>> bitIndex) & 1
        price += GetPrice(this$static.Models[m], bit)
        m = (m << 1) + bit
      }
      return price
    }

    function $ReverseEncode(this$static, rangeEncoder, symbol) {
      var bit,
        i,
        m = 1
      for (i = 0; i < this$static.NumBitLevels; ++i) {
        bit = symbol & 1
        $Encode_3(rangeEncoder, this$static.Models, m, bit)
        m = (m << 1) | bit
        symbol >>= 1
      }
    }

    function $ReverseGetPrice(this$static, symbol) {
      var bit,
        i,
        m = 1,
        price = 0
      for (i = this$static.NumBitLevels; i != 0; --i) {
        bit = symbol & 1
        symbol >>>= 1
        price += GetPrice(this$static.Models[m], bit)
        m = (m << 1) | bit
      }
      return price
    }

    function ReverseEncode(
      Models,
      startIndex,
      rangeEncoder,
      NumBitLevels,
      symbol
    ) {
      var bit,
        i,
        m = 1
      for (i = 0; i < NumBitLevels; ++i) {
        bit = symbol & 1
        $Encode_3(rangeEncoder, Models, startIndex + m, bit)
        m = (m << 1) | bit
        symbol >>= 1
      }
    }

    function ReverseGetPrice(Models, startIndex, NumBitLevels, symbol) {
      var bit,
        i,
        m = 1,
        price = 0
      for (i = NumBitLevels; i != 0; --i) {
        bit = symbol & 1
        symbol >>>= 1
        price +=
          ProbPrices[(((Models[startIndex + m] - bit) ^ -bit) & 2047) >>> 2]
        m = (m << 1) | bit
      }
      return price
    }
    /** ce */
    /** ds */
    function $DecodeBit(this$static, probs, index) {
      var newBound,
        prob = probs[index]
      newBound = (this$static.Range >>> 11) * prob
      if ((this$static.Code ^ -2147483648) < (newBound ^ -2147483648)) {
        this$static.Range = newBound
        probs[index] = ((prob + ((2048 - prob) >>> 5)) << 16) >> 16
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
        return 0
      } else {
        this$static.Range -= newBound
        this$static.Code -= newBound
        probs[index] = ((prob - (prob >>> 5)) << 16) >> 16
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
        return 1
      }
    }

    function $DecodeDirectBits(this$static, numTotalBits) {
      var i,
        t,
        result = 0
      for (i = numTotalBits; i != 0; --i) {
        this$static.Range >>>= 1
        t = (this$static.Code - this$static.Range) >>> 31
        this$static.Code -= this$static.Range & (t - 1)
        result = (result << 1) | (1 - t)
        if (!(this$static.Range & -16777216)) {
          this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
          this$static.Range <<= 8
        }
      }
      return result
    }

    function $Init_8(this$static) {
      this$static.Code = 0
      this$static.Range = -1
      for (var i = 0; i < 5; ++i) {
        this$static.Code = (this$static.Code << 8) | $read(this$static.Stream)
      }
    }
    /** de */

    function InitBitModels(probs) {
      for (var i = probs.length - 1; i >= 0; --i) {
        probs[i] = 1024
      }
    }
    /** cs */
    var ProbPrices = (function () {
      var end,
        i,
        j,
        start,
        ProbPrices = []
      for (i = 8; i >= 0; --i) {
        start = 1 << (9 - i - 1)
        end = 1 << (9 - i)
        for (j = start; j < end; ++j) {
          ProbPrices[j] = (i << 6) + (((end - j) << 6) >>> (9 - i - 1))
        }
      }
      return ProbPrices
    })()

    function $Encode_3(this$static, probs, index, symbol) {
      var newBound,
        prob = probs[index]
      newBound = (this$static.Range >>> 11) * prob
      if (!symbol) {
        this$static.Range = newBound
        probs[index] = ((prob + ((2048 - prob) >>> 5)) << 16) >> 16
      } else {
        this$static.Low = add(
          this$static.Low,
          and(fromInt(newBound), [4294967295, 0])
        )
        this$static.Range -= newBound
        probs[index] = ((prob - (prob >>> 5)) << 16) >> 16
      }
      if (!(this$static.Range & -16777216)) {
        this$static.Range <<= 8
        $ShiftLow(this$static)
      }
    }

    function $EncodeDirectBits(this$static, v, numTotalBits) {
      for (var i = numTotalBits - 1; i >= 0; --i) {
        this$static.Range >>>= 1
        if (((v >>> i) & 1) == 1) {
          this$static.Low = add(this$static.Low, fromInt(this$static.Range))
        }
        if (!(this$static.Range & -16777216)) {
          this$static.Range <<= 8
          $ShiftLow(this$static)
        }
      }
    }

    function $GetProcessedSizeAdd(this$static) {
      return add(
        add(fromInt(this$static._cacheSize), this$static._position),
        [4, 0]
      )
    }

    function $Init_9(this$static) {
      this$static._position = P0_longLit
      this$static.Low = P0_longLit
      this$static.Range = -1
      this$static._cacheSize = 1
      this$static._cache = 0
    }

    function $ShiftLow(this$static) {
      var temp,
        LowHi = lowBits_0(shru(this$static.Low, 32))
      if (LowHi != 0 || compare(this$static.Low, [4278190080, 0]) < 0) {
        this$static._position = add(
          this$static._position,
          fromInt(this$static._cacheSize)
        )
        temp = this$static._cache
        do {
          $write(this$static.Stream, temp + LowHi)
          temp = 255
        } while (--this$static._cacheSize != 0)
        this$static._cache = lowBits_0(this$static.Low) >>> 24
      }
      ++this$static._cacheSize
      this$static.Low = shl(and(this$static.Low, [16777215, 0]), 8)
    }

    function GetPrice(Prob, symbol) {
      return ProbPrices[(((Prob - symbol) ^ -symbol) & 2047) >>> 2]
    }

    /** ce */
    /** ds */
    function decode(utf) {
      var i = 0,
        j = 0,
        x,
        y,
        z,
        l = utf.length,
        buf = [],
        charCodes = []
      for (; i < l; ++i, ++j) {
        x = utf[i] & 255
        if (!(x & 128)) {
          if (!x) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = x
        } else if ((x & 224) == 192) {
          if (i + 1 >= l) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          y = utf[++i] & 255
          if ((y & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = ((x & 31) << 6) | (y & 63)
        } else if ((x & 240) == 224) {
          if (i + 2 >= l) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          y = utf[++i] & 255
          if ((y & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          z = utf[++i] & 255
          if ((z & 192) != 128) {
            /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
            return utf
          }
          charCodes[j] = ((x & 15) << 12) | ((y & 63) << 6) | (z & 63)
        } else {
          /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
          return utf
        }
        if (j == 16383) {
          buf.push(String.fromCharCode.apply(String, charCodes))
          j = -1
        }
      }
      if (j > 0) {
        charCodes.length = j
        buf.push(String.fromCharCode.apply(String, charCodes))
      }
      return buf.join('')
    }
    /** de */
    /** cs */
    function encode(s) {
      var ch,
        chars = [],
        data,
        elen = 0,
        i,
        l = s.length
      /// Be able to handle binary arrays and buffers.
      if (typeof s == 'object') {
        return s
      } else {
        $getChars(s, 0, l, chars, 0)
      }
      /// Add extra spaces in the array to break up the unicode symbols.
      for (i = 0; i < l; ++i) {
        ch = chars[i]
        if (ch >= 1 && ch <= 127) {
          ++elen
        } else if (!ch || (ch >= 128 && ch <= 2047)) {
          elen += 2
        } else {
          elen += 3
        }
      }
      data = []
      elen = 0
      for (i = 0; i < l; ++i) {
        ch = chars[i]
        if (ch >= 1 && ch <= 127) {
          data[elen++] = (ch << 24) >> 24
        } else if (!ch || (ch >= 128 && ch <= 2047)) {
          data[elen++] = ((192 | ((ch >> 6) & 31)) << 24) >> 24
          data[elen++] = ((128 | (ch & 63)) << 24) >> 24
        } else {
          data[elen++] = ((224 | ((ch >> 12) & 15)) << 24) >> 24
          data[elen++] = ((128 | ((ch >> 6) & 63)) << 24) >> 24
          data[elen++] = ((128 | (ch & 63)) << 24) >> 24
        }
      }
      return data
    }
    /** ce */

    function toDouble(a) {
      return a[1] + a[0]
    }

    /** cs */
    function compress(str, mode, on_finish, on_progress) {
      var this$static = {},
        percent,
        cbn, /// A callback number should be supplied instead of on_finish() if we are using Web Workers.
        sync =
          typeof on_finish == 'undefined' && typeof on_progress == 'undefined'

      if (typeof on_finish != 'function') {
        cbn = on_finish
        on_finish = on_progress = 0
      }

      on_progress =
        on_progress ||
        function (percent) {
          if (typeof cbn == 'undefined') return

          return update_progress(percent, cbn)
        }

      on_finish =
        on_finish ||
        function (res, err) {
          if (typeof cbn == 'undefined') return

          return postMessage({
            action: action_compress,
            cbn: cbn,
            result: res,
            error: err
          })
        }

      if (sync) {
        this$static.c = $LZMAByteArrayCompressor(
          {},
          encode(str),
          get_mode_obj(mode)
        )
        while ($processChunk(this$static.c.chunker));
        return $toByteArray(this$static.c.output)
      }

      try {
        this$static.c = $LZMAByteArrayCompressor(
          {},
          encode(str),
          get_mode_obj(mode)
        )

        on_progress(0)
      } catch (err) {
        return on_finish(null, err)
      }

      function do_action() {
        try {
          var res,
            start = new Date().getTime()

          while ($processChunk(this$static.c.chunker)) {
            percent =
              toDouble(this$static.c.chunker.inBytesProcessed) /
              toDouble(this$static.c.length_0)
            /// If about 200 miliseconds have passed, update the progress.
            if (new Date().getTime() - start > 200) {
              on_progress(percent)

              wait(do_action, 0)
              return 0
            }
          }

          on_progress(1)

          res = $toByteArray(this$static.c.output)

          /// delay so we don’t catch errors from the on_finish handler
          wait(on_finish.bind(null, res), 0)
        } catch (err) {
          on_finish(null, err)
        }
      }

      ///NOTE: We need to wait to make sure it is always async.
      wait(do_action, 0)
    }
    /** ce */
    /** ds */
    function decompress(byte_arr, on_finish, on_progress) {
      var this$static = {},
        percent,
        cbn, /// A callback number should be supplied instead of on_finish() if we are using Web Workers.
        has_progress,
        len,
        sync =
          typeof on_finish == 'undefined' && typeof on_progress == 'undefined'

      if (typeof on_finish != 'function') {
        cbn = on_finish
        on_finish = on_progress = 0
      }

      on_progress =
        on_progress ||
        function (percent) {
          if (typeof cbn == 'undefined') return

          return update_progress(has_progress ? percent : -1, cbn)
        }

      on_finish =
        on_finish ||
        function (res, err) {
          if (typeof cbn == 'undefined') return

          return postMessage({
            action: action_decompress,
            cbn: cbn,
            result: res,
            error: err
          })
        }

      if (sync) {
        this$static.d = $LZMAByteArrayDecompressor({}, byte_arr)
        while ($processChunk(this$static.d.chunker));
        return decode($toByteArray(this$static.d.output))
      }

      try {
        this$static.d = $LZMAByteArrayDecompressor({}, byte_arr)

        len = toDouble(this$static.d.length_0)

        ///NOTE: If the data was created via a stream, it will not have a length value, and therefore we can't calculate the progress.
        has_progress = len > -1

        on_progress(0)
      } catch (err) {
        return on_finish(null, err)
      }

      function do_action() {
        try {
          var res,
            i = 0,
            start = new Date().getTime()
          while ($processChunk(this$static.d.chunker)) {
            if (++i % 1000 == 0 && new Date().getTime() - start > 200) {
              if (has_progress) {
                percent = toDouble(this$static.d.chunker.decoder.nowPos64) / len
                /// If about 200 miliseconds have passed, update the progress.
                on_progress(percent)
              }

              ///NOTE: This allows other code to run, like the browser to update.
              wait(do_action, 0)
              return 0
            }
          }

          on_progress(1)

          res = decode($toByteArray(this$static.d.output))

          /// delay so we don’t catch errors from the on_finish handler
          wait(on_finish.bind(null, res), 0)
        } catch (err) {
          on_finish(null, err)
        }
      }

      ///NOTE: We need to wait to make sure it is always async.
      wait(do_action, 0)
    }
    /** de */
    /** cs */
    var get_mode_obj = (function () {
      /// s is dictionarySize
      /// f is fb
      /// m is matchFinder
      ///NOTE: Because some values are always the same, they have been removed.
      /// lc is always 3
      /// lp is always 0
      /// pb is always 2
      var modes = [
        { s: 16, f: 64, m: 0 },
        { s: 20, f: 64, m: 0 },
        { s: 19, f: 64, m: 1 },
        { s: 20, f: 64, m: 1 },
        { s: 21, f: 128, m: 1 },
        { s: 22, f: 128, m: 1 },
        { s: 23, f: 128, m: 1 },
        { s: 24, f: 255, m: 1 },
        { s: 25, f: 255, m: 1 }
      ]

      return function (mode) {
        return modes[mode - 1] || modes[6]
      }
    })()
    /** ce */

    /// If we're in a Web Worker, create the onmessage() communication channel.
    ///NOTE: This seems to be the most reliable way to detect this.
    if (
      typeof onmessage != 'undefined' &&
      (typeof window == 'undefined' || typeof window.document == 'undefined')
    ) {
      ;(function () {
        /* jshint -W020 */
        /// Create the global onmessage function.
        onmessage = function (e) {
          if (e && e.data) {
            /** xs */
            if (e.data.action == action_decompress) {
              LZMA.decompress(e.data.data, e.data.cbn)
            } else if (e.data.action == action_compress) {
              LZMA.compress(e.data.data, e.data.mode, e.data.cbn)
            }
            /** xe */
            /// co:if (e.data.action == action_compress) {
            /// co:    LZMA.compress(e.data.data, e.data.mode, e.data.cbn);
            /// co:}
            /// do:if (e.data.action == action_decompress) {
            /// do:    LZMA.decompress(e.data.data, e.data.cbn);
            /// do:}
          }
        }
      })()
    }

    return {
      /** xs */
      compress: compress,
      decompress: decompress
      /** xe */
      /// co:compress:   compress
      /// do:decompress: decompress
    }
  })()

  /// This is used by browsers that do not support web workers (and possibly Node.js).
  commonjsGlobal.LZMA = commonjsGlobal.LZMA_WORKER = LZMA

  //import 'node-self' //TODO : use this one for useGlobal?
  var lzma = () => {
    const isNode = typeof process === 'object' && typeof window !== 'object'
    const useGlobal = isNode ? global : window
    const { LZMA /*, LZMA_WORKER*/ } = useGlobal || {}
    //console.log({ LZMA_WORKER, LZMA })
    return LZMA
  }

  var lzma$1 = /*#__PURE__*/ Object.freeze({
    __proto__: null,
    default: lzma
  })

  exports.config = config
  exports.default = _handlers
  exports.encodings = encodings
  exports.gc = gc
  exports.testDeps = testDeps

  Object.defineProperty(exports, '__esModule', { value: true })
})
