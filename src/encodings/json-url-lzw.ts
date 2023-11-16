import { EncodingHandler } from "../types";
import Codec from 'json-url';

const lzwCodec = Codec('lzw');

const handler:EncodingHandler = { 
  name    :"JSON-URL LZW",
  encoder:(obj:any/*,_options?:any*/)      =>lzwCodec.compress    (obj),
  decoder:(msg:string/*,_options?:any*/)   =>lzwCodec.decompress  (msg),
}

export default handler;
