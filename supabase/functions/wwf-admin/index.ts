import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { ADMIN_EMAIL, validateContent, referencedMedia, MEDIA_PATH, IMAGE_LIMIT, AUDIO_LIMIT, STORAGE_LIMIT } from '../_shared/content.mjs';

const origin = 'https://world-wide-frequencies.vercel.app';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession:false,autoRefreshToken:false } });
const sha = async (value: string | ArrayBuffer) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(b=>b.toString(16).padStart(2,'0')).join('');
const check = (result: any) => { if(result.error) throw new Error('No se pudo completar la operación.'); return result.data; };
function response(data:any, status=200, cors='') { return new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':cors,'Vary':'Origin','X-Content-Type-Options':'nosniff'}}); }
async function config() { return check(await db.from('wwf_secrets').select('*').single()); }
async function owner(token:string) {
  const {data,error}=await db.auth.getUser(token);
  if(error||!data.user) throw Object.assign(new Error('Inicia sesión para continuar.'),{status:401});
  const admin=check(await db.from('wwf_admin').select('user_id').maybeSingle());
  if(!admin||admin.user_id!==data.user.id) throw Object.assign(new Error('Esta cuenta no tiene permisos.'),{status:403});
  return data.user;
}
async function mediaManifest(content:any) {
  const paths=referencedMedia(content);
  if(!paths.length)return [];
  const rows=check(await db.from('wwf_media').select('*').in('path',paths));
  if(rows.length!==paths.length) throw new Error('Faltan archivos de la biblioteca.');
  const signed=check(await db.storage.from('wwf-media').createSignedUrls(paths,900));
  return rows.map((row:any)=>({...row,url:signed.find((s:any)=>s.path===row.path)?.signedUrl}));
}
async function currentDraft() {return check(await db.from('wwf_draft').select('*').single());}
async function validateMedia(content:any) {
  const assets=await mediaManifest(content);
  for(const a of content.artists)if(a.image?.startsWith('media/')&&!a.image.endsWith('.webp'))throw new Error('La fotografía debe ser una imagen.');
  for(const a of content.albums){
    if(a.cover?.startsWith('media/')&&!a.cover.endsWith('.webp'))throw new Error('La portada debe ser una imagen.');
    for(const t of a.tracks)if(t.previewUrl){const m=assets.find((m:any)=>m.path===t.previewUrl);if(m?.mime!=='audio/mpeg'||!m.duration||m.duration>30.1)throw new Error('El fragmento debe ser MP3 y durar un máximo de 30 segundos.');}
  }
}

Deno.serve(async req=>{
  const requestOrigin=req.headers.get('origin')||'';
  const allowedOrigin=requestOrigin===origin||/^http:\/\/127\.0\.0\.1:(5173|5174)$/.test(requestOrigin);
  const cors=allowedOrigin?requestOrigin:'';
  if(requestOrigin&&!allowedOrigin)return response({error:'Origen no permitido.'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':cors,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-build-token, x-file-name, x-audio-duration','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Max-Age':'3600','Vary':'Origin'}});
  const action=new URL(req.url).searchParams.get('action');
  try{
    if(action==='build-readiness'&&req.method==='GET'){
      const secret=await config();
      return response({requiresToken:Boolean(secret.deploy_hook)},200,cors);
    }
    if(action==='export'){
      if(req.method!=='GET')return response({error:'Método no permitido.'},405,cors);
      const secret=await config();
      if(await sha(req.headers.get('x-build-token')||'')!==secret.build_hash)return response({error:'Acceso denegado.'},401,cors);
      const all=check(await db.from('wwf_publications').select('*').in('state',['pending','live']).order('created_at',{ascending:false}));
      const publication=all.find((p:any)=>p.state==='pending')||all.find((p:any)=>p.state==='live');
      if(!publication)throw new Error('No hay una versión publicada.');
      validateContent(publication.content,{publishing:true});
      return response({revision:publication.id,content:publication.content,media:await mediaManifest(publication.content)},200,cors);
    }
    if(action==='provision'||action==='activate'){
      if(req.method!=='POST')return response({error:'Método no permitido.'},405,cors);
      const body=await req.json(); const secret=await config();
      if(secret.bootstrap_used||await sha(body.token||'')!==secret.bootstrap_hash)return response({error:'El enlace de activación no es válido o ya se utilizó.'},403,cors);
      let admin=check(await db.from('wwf_admin').select('user_id').maybeSingle());
      if(!admin){
        const created=await db.auth.admin.createUser({email:ADMIN_EMAIL,email_confirm:true,password:crypto.randomUUID()+crypto.randomUUID()});
        const user=check(created).user;
        if(!user)throw new Error('No se pudo crear la cuenta.');
        check(await db.from('wwf_admin').insert({user_id:user.id}));admin={user_id:user.id};
      }
      if(action==='provision'){
        const result:any={provisioned:true};
        if(body.testSession===true){
          const link=check(await db.auth.admin.generateLink({type:'recovery',email:ADMIN_EMAIL}));
          result.tokenHash=link.properties.hashed_token;
        }
        return response(result,200,cors);
      }
      if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)return response({error:'Elige una contraseña de entre 12 y 128 caracteres.'},400,cors);
      const claimed=check(await db.from('wwf_secrets').update({bootstrap_used:true}).eq('singleton',true).eq('bootstrap_used',false).select('singleton'));
      if(!claimed.length)return response({error:'El enlace ya se ha utilizado.'},409,cors);
      const updated=await db.auth.admin.updateUserById(admin.user_id,{password:body.password});
      if(updated.error){await db.from('wwf_secrets').update({bootstrap_used:false}).eq('singleton',true);throw new Error('No se pudo establecer la contraseña. Reinténtalo.');}
      return response({activated:true,email:ADMIN_EMAIL},200,cors);
    }
    const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
    await owner(token);
    if(action==='configure-publishing'&&req.method==='POST'){
      const {hook}=await req.json();
      if(typeof hook!=='string'||!/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_/-]+$/.test(hook))throw new Error('El Deploy Hook de Vercel no es válido.');
      check(await db.from('wwf_secrets').update({deploy_hook:hook}).eq('singleton',true));
      return response({configured:true},200,cors);
    }
    if(action==='retry-publication'&&req.method==='POST'){
      const {id}=await req.json();const secret=await config();
      const pending=check(await db.from('wwf_publications').select('id').eq('id',id).eq('state','pending').single());
      if(!secret.deploy_hook)throw new Error('Falta conectar Vercel.');
      const trigger=await fetch(secret.deploy_hook,{method:'POST'});
      if(!trigger.ok)throw new Error('Vercel no pudo iniciar la publicación.');
      return response({id:pending.id,state:'pending'},202,cors);
    }
    if(action==='draft'&&req.method==='GET'){
      const draft=await currentDraft();
      return response({...draft,media:await mediaManifest(draft.content)},200,cors);
    }
    if(action==='draft'&&req.method==='POST'){
      const body=await req.json();validateContent(body.content);await validateMedia(body.content);
      const rows=check(await db.rpc('wwf_save_draft',{p_content:body.content,p_version:body.version}));
      if(!rows.length)return response({error:'El borrador cambió en otra pestaña. Recarga antes de guardar.'},409,cors);
      return response(rows[0],200,cors);
    }
    if(action==='media'&&req.method==='GET'){
      const rows=check(await db.from('wwf_media').select('*').order('created_at',{ascending:false}));
      const urls=rows.length?check(await db.storage.from('wwf-media').createSignedUrls(rows.map((r:any)=>r.path),900)):[];
      return response({files:rows.map((r:any)=>({...r,url:urls.find((u:any)=>u.path===r.path)?.signedUrl})),bytes:rows.reduce((n:number,r:any)=>n+r.bytes,0),limit:STORAGE_LIMIT},200,cors);
    }
    if(action==='upload'&&req.method==='POST'){
      const mime=req.headers.get('content-type')?.split(';')[0];
      const duration=Number(req.headers.get('x-audio-duration'));
      const maximum=mime==='image/webp'?IMAGE_LIMIT:mime==='audio/mpeg'?AUDIO_LIMIT:0;
      if(!maximum||Number(req.headers.get('content-length'))>maximum)return response({error:'El tipo o tamaño de archivo no está permitido.'},400,cors);
      const bytes=await req.arrayBuffer();const buffer=new Uint8Array(bytes);
      if(!buffer.length||buffer.length>maximum)throw new Error('El archivo supera el límite permitido.');
      if(mime==='audio/mpeg'&&(!Number.isFinite(duration)||duration<=0||duration>30.1))throw new Error('Sube un fragmento MP3 de un máximo de 30 segundos.');
      if(mime==='image/webp'&&(new TextDecoder().decode(buffer.slice(0,4))!=='RIFF'||new TextDecoder().decode(buffer.slice(8,12))!=='WEBP'))throw new Error('La imagen WebP no es válida.');
      if(mime==='audio/mpeg'&&!(new TextDecoder().decode(buffer.slice(0,3))==='ID3'||(buffer[0]===255&&(buffer[1]&224)===224)))throw new Error('El archivo MP3 no es válido.');
      const path=`media/${await sha(bytes)}.${mime==='image/webp'?'webp':'mp3'}`;
      const existing=check(await db.from('wwf_media').select('*').eq('path',path).maybeSingle());
      if(existing)return response(existing,200,cors);
      const rows=check(await db.from('wwf_media').select('bytes'));
      if(rows.reduce((n:number,r:any)=>n+r.bytes,0)+buffer.length>STORAGE_LIMIT)throw new Error('La biblioteca ha alcanzado su límite de 50 MB. Elimina archivos sin uso.');
      check(await db.storage.from('wwf-media').upload(path,bytes,{contentType:mime,upsert:false}));
      const record={path,bytes:buffer.length,mime,duration:mime==='audio/mpeg'?duration:null,original_name:decodeURIComponent(req.headers.get('x-file-name')||'Archivo').slice(0,200)};
      const inserted=await db.from('wwf_media').insert(record).select().single();
      if(inserted.error){await db.storage.from('wwf-media').remove([path]);throw new Error('No se pudo registrar el archivo.');}
      return response(inserted.data,201,cors);
    }
    if(action==='delete-media'&&req.method==='POST'){
      const {path}=await req.json();if(!MEDIA_PATH.test(path))throw new Error('Archivo no válido.');
      const draft=await currentDraft();const publications=check(await db.from('wwf_publications').select('content'));
      if([draft.content,...publications.map((p:any)=>p.content)].some(c=>referencedMedia(c).includes(path)))throw new Error('Este archivo se usa en un borrador o una versión conservada.');
      check(await db.storage.from('wwf-media').remove([path]));check(await db.from('wwf_media').delete().eq('path',path));
      return response({deleted:true},200,cors);
    }
    if(action==='publish'&&req.method==='POST'){
      const {version}=await req.json();const draft=await currentDraft();
      if(version!==draft.version)return response({error:'Guarda o recarga el borrador antes de publicar.'},409,cors);
      validateContent(draft.content,{publishing:true});await validateMedia(draft.content);
      const secret=await config();
      if(!/^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\//.test(secret.deploy_hook))return response({error:'Falta conectar la publicación con Vercel. El borrador está guardado.'},503,cors);
      const publication=check(await db.rpc('wwf_publish',{p_version:version}));
      const trigger=await fetch(secret.deploy_hook,{method:'POST'});
      if(!trigger.ok){await db.from('wwf_publications').update({state:'failed'}).eq('id',publication.id);throw new Error('Vercel no pudo iniciar la publicación. La web anterior sigue disponible.');}
      return response({id:publication.id,state:'pending'},202,cors);
    }
    if(action==='status'&&req.method==='GET'){
      const pending=check(await db.from('wwf_publications').select('id,created_at').eq('state','pending').maybeSingle());
      if(pending){
        try{
          const deployed=await fetch(`${origin}/publication.json?check=${Date.now()}`,{cache:'no-store'});
          const meta=deployed.ok?await deployed.json():null;
          if(meta?.revision===pending.id)check(await db.rpc('wwf_mark_live',{p_id:pending.id}));
        }catch{/* Keep the last live version when production cannot be verified. */}
      }
      const publications=check(await db.from('wwf_publications').select('id,draft_version,state,created_at,published_at').order('created_at',{ascending:false}));
      return response({publications},200,cors);
    }
    if(action==='restore'&&req.method==='POST'){
      const {id,version}=await req.json();const previous=check(await db.from('wwf_publications').select('content').eq('id',id).in('state',['live','previous']).single());
      const rows=check(await db.rpc('wwf_save_draft',{p_content:previous.content,p_version:version}));
      if(!rows.length)return response({error:'El borrador cambió. Recarga antes de restaurar.'},409,cors);
      return response(rows[0],200,cors);
    }
    return response({error:'Operación no disponible.'},404,cors);
  }catch(error:any){return response({error:error.message||'No se pudo completar la operación.'},error.status||400,cors);}
});
