import { EncodingHandler } from "../types";
import Codec from 'json-url';

const lzmaCodec = Codec('lzma');

const handler:EncodingHandler = { 
  name    :"JSON-URL LZMA",
  encoder:(obj:any/*,_options?:any*/)      =>lzmaCodec.compress    (obj),
  decoder:(msg:string/*,_options?:any*/)   =>lzmaCodec.decompress  (msg),
}

export default handler;
