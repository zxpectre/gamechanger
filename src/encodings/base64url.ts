import { EncodingHandler } from "../types";

import safeJSONStringify    from 'json-stringify-safe'
import URLSafeBase64        from 'urlsafe-base64'


const handler:EncodingHandler = {
  name    :"URL Safe Base64",
  encoder :(obj:any/*,_options?:any*/)      =>Promise.resolve(URLSafeBase64.encode(Buffer.from(safeJSONStringify(obj),'utf-8'))),
  decoder :(msg:string/*,_options?:any*/)   =>Promise.resolve(JSON.parse(Buffer.from(URLSafeBase64.decode(msg),'utf-8').toString('utf-8'))),
}

export default handler;
