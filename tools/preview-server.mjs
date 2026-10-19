import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root=process.cwd();
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8"};
http.createServer(async(req,res)=>{
  try { const url=new URL(req.url,"http://localhost");const file=path.resolve(root,"."+decodeURIComponent(url.pathname==="/"?"/tests/preview.html":url.pathname));
    if (!file.startsWith(root+path.sep) || !/\/(?:scripts|styles|lang|tests)\//.test(url.pathname==="/"?"/tests/preview.html":url.pathname)) throw new Error("Denied");
    const data=await fs.readFile(file);res.writeHead(200,{"Content-Type":types[path.extname(file)]??"application/octet-stream"});res.end(data);
  }catch{res.writeHead(404);res.end("Not found");}
}).listen(Number(process.argv[2]||4173),"127.0.0.1",()=>console.log(`UI verification: http://127.0.0.1:${process.argv[2]||4173}`));
