import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateContent, referencedMedia } from '../lib/content.mjs';

let media=[];
export async function loadPublishedContent(root) {
  media=[];
  const config=JSON.parse(await readFile(path.join(root,'admin/config.json'),'utf8'));
  const token=process.env.WWF_BUILD_TOKEN;
  if(!token){
    if(process.env.VERCEL){
      const check=await fetch(`${config.url}/functions/v1/${config.functionName}?action=build-readiness`,{signal:AbortSignal.timeout(15000)});
      if(!check.ok)throw new Error('Cannot verify publication configuration. Refusing to replace CMS content with local content.');
      const ready=await check.json();
      if(ready.requiresToken||config.requireRemoteBuild)throw new Error('WWF_BUILD_TOKEN is required. Refusing to overwrite the CMS catalog with local content.');
    }
    return {content:JSON.parse(await readFile(path.join(root,'data/content.json'),'utf8')),revision:'local-source'};
  }
  const response=await fetch(`${config.url}/functions/v1/${config.functionName}?action=export`,{headers:{'x-build-token':token,apikey:config.publishableKey},signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`Could not read the approved publication (${response.status}).`);
  const result=await response.json();validateContent(result.content,{publishing:true});
  if(!/^[a-f0-9-]{36}$/.test(result.revision))throw new Error('Invalid publication revision.');
  const expected=new Set(referencedMedia(result.content));
  media=result.media;
  if(media.length!==expected.size || media.some(m=>!expected.has(m.path)||new URL(m.url).origin!==config.url))throw new Error('Invalid publication media manifest.');
  const content=structuredClone(result.content);
  const mapped=p=>p?.startsWith('media/')?`assets/uploads/${p.slice(6)}`:p;
  for(const a of content.artists)a.image=mapped(a.image);
  for(const a of content.albums){a.cover=mapped(a.cover);for(const t of a.tracks)t.previewUrl=mapped(t.previewUrl);}
  return {content,revision:result.revision};
}
loadPublishedContent.materialize=async out=>{
  if(!media.length)return;
  const dir=path.join(out,'assets/uploads');await mkdir(dir,{recursive:true});
  for(const file of media){
    const response=await fetch(file.url,{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw new Error('A publication file could not be downloaded.');
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length!==file.bytes||bytes.length>2097152)throw new Error('Publication file size mismatch.');
    const { createHash }=await import('node:crypto');
    if(createHash('sha256').update(bytes).digest('hex')!==file.path.slice(6).split('.')[0])throw new Error('Publication file checksum mismatch.');
    await writeFile(path.join(dir,path.basename(file.path)),bytes);
  }
};
