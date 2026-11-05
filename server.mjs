import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(workspace, process.argv[2] || 'dist');
if (!root.startsWith(workspace + path.sep)) throw new Error('Serve a generated directory inside this checkout.');
const port = Number(process.env.PORT || 5173);
const types = {'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{
  if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
  try {
    const url = new URL(req.url,'http://localhost');
    const route = decodeURIComponent(url.pathname);
    const file = path.resolve(root, '.'+(route==='/'?'/index.html':route));
    if (!file.startsWith(root+path.sep) || route.split('/').some(p=>p.startsWith('.'))) {res.writeHead(403);res.end('Forbidden');return;}
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    const headers = {'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
    let start=0, end=info.size-1, code=200;
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1]&&!match[2])) {res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      if(match[1]) {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;}
      else start=Math.max(0,info.size-Number(match[2]));
      if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
      code=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
    }
    headers['Content-Length']=Math.max(0,end-start+1);
    res.writeHead(code,headers);
    if(req.method==='HEAD'||info.size===0)res.end();
    else createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
  }catch{
    const body=await readFile(path.join(root,'404.html')).catch(()=>Buffer.from('Not found'));
    res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?undefined:body);
  }
}).listen(port,'127.0.0.1',()=>console.log(`World Wide Frequencies running at http://127.0.0.1:${port}/`));
