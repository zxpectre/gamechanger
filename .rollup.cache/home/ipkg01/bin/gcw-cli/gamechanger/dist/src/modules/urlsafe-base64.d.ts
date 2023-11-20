/**
 * Based on urlsafe-base64, on version:
 */
/// <reference types="node" />
declare const version = '1.0.0'
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
declare function encode(buffer: Buffer): string
/**
 * .decode
 *
 * return an decoded URL Safe Base64 as Buffer
 *
 * @param {String}
 * @return {Buffer}
 * @api public
 */
declare function decode(base64: string): Buffer
/**
 * .validate
 *
 * Validates a string if it is URL Safe Base64 encoded.
 *
 * @param {String}
 * @return {Boolean}
 * @api public
 */
declare function validate(base64: any): boolean
export { version, encode, decode, validate }
//# sourceMappingURL=urlsafe-base64.d.ts.map
