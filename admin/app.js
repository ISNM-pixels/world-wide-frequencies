import { createClient } from '@supabase/supabase-js';
import config from './config.json';
import { IMAGE_LIMIT, AUDIO_LIMIT, validateContent } from '../lib/content.mjs';

const supabase = createClient(config.url, config.publishableKey, {auth:{storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const app=document.querySelector('#app'), notice=document.querySelector('#notice');
const state={content:null,version:0,dirty:false,section:'overview',index:0,session:null,media:[],bytes:0,publications:[],busy:false};
let activation=new URLSearchParams(location.hash.slice(1)).get('activate');
if(activation)history.replaceState(null,'',location.pathname);
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=path=>path.split('.').reduce((v,k)=>v?.[k],state.content);
const set=(path,value)=>{const keys=path.split('.'),key=keys.pop();let obj=state.content;for(const k of keys)obj=obj[k];obj[key]=value;state.dirty=true;updateSaveStatus();};
const say=(text,error=false)=>{notice.textContent=text;notice.className=error?'error':'ok';notice.hidden=!text;};
async function api(action,{method='GET',body,headers={}}={}){
  const options={method,headers:{...headers,apikey:config.publishableKey}};
  if(state.session)options.headers.Authorization=`Bearer ${state.session.access_token}`;
  if(body instanceof Blob){options.body=body;}
  else if(body!==undefined){options.body=JSON.stringify(body);options.headers['Content-Type']='application/json';}
  const r=await fetch(`${config.url}/functions/v1/${config.functionName}?action=${encodeURIComponent(action)}`,{...options,signal:AbortSignal.timeout(45000)});
  const data=await r.json().catch(()=>({error:'Respuesta no válida del servidor.'}));
  if(!r.ok){if(r.status===401){state.session=null;renderLogin();}throw new Error(data.error||'No se pudo completar la operación.');}
  return data;
}
async function run(work){if(state.busy)return;state.busy=true;document.body.classList.add('busy');try{await work();}catch(e){say(e.message,true);}finally{state.busy=false;document.body.classList.remove('busy');}}
function field(label,path,{type='text',area=false,readonly=false,placeholder=''}={}){
  const value=get(path)??'';const id='field-'+path.replaceAll('.','-');
  return `<label for="${id}">${esc(label)}${area?`<textarea id="${id}" data-path="${path}" rows="5" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input id="${id}" data-path="${path}" type="${type}" value="${esc(value)}" ${readonly?'readonly':''} placeholder="${esc(placeholder)}">`}</label>`;
}
function choice(label,path,options){return `<label>${esc(label)}<select data-path="${path}">${options.map(([v,l])=>`<option value="${esc(v)}" ${get(path)===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;}
const button=(label,action,extra='',cls='secondary')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
const signed=path=>state.media.find(m=>m.path===path)?.url||(path?.startsWith('assets/')?'/'+path:'');
function mediaField(label,path,kind){
  const value=get(path)||'';const files=state.media.filter(m=>kind==='image'?m.mime==='image/webp':m.mime==='audio/mpeg');
  return `<div class="media-field"><label>${esc(label)}<select data-path="${path}" data-media-choice><option value="">Sin archivo</option>${files.map(m=>`<option value="${esc(m.path)}" ${value===m.path?'selected':''}>${esc(m.original_name)}</option>`).join('')}</select></label><label class="upload-label">${kind==='image'?'Subir imagen':'Subir fragmento MP3'}<input type="file" data-upload="${path}" data-kind="${kind}" accept="${kind==='image'?'image/jpeg,image/png,image/webp':'audio/mpeg,.mp3'}"></label>${value&&signed(value)?kind==='image'?`<img class="selected-image" src="${esc(signed(value))}" alt="Imagen seleccionada">`:`<audio controls preload="none" src="${esc(signed(value))}"></audio>`:''}<small>${kind==='image'?'Se optimiza a WebP, máximo 1600 px y 500 KB.':'Fragmento ya preparado: máximo 30 segundos y 2 MB.'}</small></div>`;
}
function links(path,title){const items=get(path)||[];return `<section class="editor-group"><h3>${esc(title)}</h3>${items.map((_,i)=>`<div class="link-row">${field('Plataforma / nombre',`${path}.${i}.label`)}${field('Enlace',`${path}.${i}.url`,{type:'url',placeholder:'https://'})}${button('Quitar','remove-link',`data-path="${path}" data-index="${i}"`)}</div>`).join('')}${button('Añadir enlace','add-link',`data-path="${path}"`)}</section>`;}
function updateSaveStatus(){const target=document.querySelector('[data-save-status]');if(target)target.textContent=state.dirty?'Cambios sin guardar':`Borrador guardado · versión ${state.version}`;}
function renderLogin(){
  app.innerHTML=`<main class="login-card"><span class="kicker">Acceso privado</span><h1>Tu sello.<br>Tu espacio.</h1><p>Accede para administrar el catálogo de World Wide Frequencies.</p><form id="login"><label>Email<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><button type="submit">Entrar</button></form><p class="small">Acceso exclusivo del administrador. Si necesitas restablecer la contraseña, utiliza tu cuenta propietaria de Supabase.</p></main>`;
  document.querySelector('#login').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const fields=new FormData(e.target);const {data,error}=await supabase.auth.signInWithPassword({email:fields.get('email'),password:fields.get('password')});if(error)throw new Error('No se pudo iniciar sesión. Revisa tus credenciales.');state.session=data.session;await load();});});
}
function renderActivation(){
  app.innerHTML=`<main class="login-card"><span class="kicker">Primera configuración</span><h1>Activa tu acceso.</h1><p>Establece la contraseña de administración para tu cuenta de World Wide Frequencies. Esta contraseña es independiente de la base de datos.</p><form id="activate"><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><label>Repite la contraseña<input name="confirm" type="password" autocomplete="new-password" minlength="12" maxlength="128" required></label><button type="submit">Activar mi cuenta</button></form></main>`;
  document.querySelector('#activate').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const fields=new FormData(e.target);if(fields.get('password')!==fields.get('confirm'))throw new Error('Las contraseñas no coinciden.');await api('activate',{method:'POST',body:{token:activation,password:fields.get('password')}});activation=null;renderLogin();say('Cuenta activada. Ya puedes iniciar sesión.');});});
}
async function load(){
  const [draft,media,status]=await Promise.all([api('draft'),api('media'),api('status')]);
  state.content=draft.content;state.version=draft.version;state.dirty=false;state.media=media.files;state.bytes=media.bytes;state.publications=status.publications;
  render();say('');
}
function render(){
  if(!state.session||!state.content){renderLogin();return;}
  const sections=[['overview','Resumen'],['artists','Artistas'],['albums','Lanzamientos'],['media','Biblioteca'],['settings','Configuración']];
  app.innerHTML=`<div class="admin-layout"><aside class="sidebar"><p class="kicker">Panel de control</p><nav>${sections.map(([id,label])=>button(label,'section',`data-section="${id}" ${state.section===id?'aria-current="page"':''}`)).join('')}</nav><p class="account">${esc(state.session.user.email)}</p>${button('Cerrar sesión','logout')}</aside><main class="workspace"><div class="workspace-top"><div><h1>${sections.find(s=>s[0]===state.section)[1]}</h1><p data-save-status></p></div><div class="toolbar">${button('Vista previa','preview')}${button('Guardar borrador','save')}${button('Publicar','publish','','primary')}</div></div><div id="workspace-body">${renderSection()}</div></main></div>`;
  updateSaveStatus();
}
function renderSection(){
  if(state.section==='overview')return `<div class="stat-grid"><div><strong>${state.content.artists.length}</strong><span>Artistas</span></div><div><strong>${state.content.albums.length}</strong><span>Lanzamientos</span></div><div><strong>${(state.bytes/1024/1024).toFixed(1)} MB</strong><span>Biblioteca / 50 MB</span></div></div><section class="panel"><h2>De borrador a publicación</h2><p>Guarda tus cambios y revísalos antes de publicar. La web pública conserva la última versión hasta que Vercel termine la nueva publicación.</p>${button('Comprobar publicación','refresh-status')}<div class="publication-list">${state.publications.map(p=>`<div><span>${new Date(p.created_at).toLocaleString('es-ES')}</span><strong>${({live:'Publicada',pending:'Publicando',previous:'Anterior',failed:'Error'})[p.state]}</strong>${['live','previous'].includes(p.state)?button('Recuperar como borrador','restore',`data-id="${esc(p.id)}"`):p.state==='pending'?button('Reintentar','retry-publication',`data-id="${esc(p.id)}"`):''}</div>`).join('')}</div></section>`;
  if(state.section==='artists')return renderArtist();
  if(state.section==='albums')return renderAlbum();
  if(state.section==='media')return `<section class="panel"><h2>Biblioteca privada</h2><p>${(state.bytes/1024/1024).toFixed(2)} MB utilizados de 50 MB. Los archivos publicados se sirven desde Vercel.</p>${button('Actualizar archivos','refresh-media')}<div class="library-grid">${state.media.map(m=>`<article>${m.mime==='image/webp'?`<img src="${esc(m.url)}" alt="${esc(m.original_name)}" loading="lazy">`:`<audio controls preload="none" src="${esc(m.url)}"></audio>`}<strong>${esc(m.original_name)}</strong><small>${Math.ceil(m.bytes/1024)} KB${m.duration?' · '+m.duration.toFixed(1)+' s':''}</small>${button('Eliminar archivo sin uso','delete-media',`data-path="${esc(m.path)}"`)}</article>`).join('')||'<p>No hay archivos todavía. Súbelos desde un artista o una pista.</p>'}</div></section>`;
  return `<section class="panel"><h2>Identidad y contacto</h2>${field('Nombre del sello','site.brand')}${field('Lema','site.tagline')}${field('Presentación del sello','site.about',{area:true})}${field('Email de contacto','site.contact.email',{type:'email'})}${field('Email de soporte','site.contact.supportEmail',{type:'email'})}${choice('Lanzamiento destacado','site.featuredReleaseId',[['','Automático / sin destacado'],...state.content.albums.map(a=>[a.id,a.title])])}${links('site.socials','Redes del sello')}${links('site.legal','Enlaces legales')}<section class="editor-group"><h3>Conexión inicial con Vercel</h3><p class="small">Configura primero WWF_BUILD_TOKEN en Vercel. Después guarda aquí el Deploy Hook del proyecto. El valor se conserva únicamente en el servidor.</p><label>Deploy Hook<input id="deploy-hook" type="password" autocomplete="off" placeholder="https://api.vercel.com/v1/integrations/deploy/…"></label>${button('Conectar publicación','configure-publishing')}</section></section>`;
}
function picker(kind){const list=state.content[kind];return `<div class="entry-picker"><label>${kind==='artists'?'Artista':'Lanzamiento'}<select data-picker="${kind}">${list.map((a,i)=>`<option value="${i}" ${i===state.index?'selected':''}>${esc(a.name||a.title)}</option>`).join('')}</select></label>${button(kind==='artists'?'Nuevo artista':'Nuevo lanzamiento','add-entry',`data-kind="${kind}"`,'primary')}</div>`;}
function reorder(kind){return `<div class="editor-footer">${button('Subir posición','move-entry',`data-kind="${kind}" data-direction="-1"`)}${button('Bajar posición','move-entry',`data-kind="${kind}" data-direction="1"`)}${button('Eliminar','delete-entry',`data-kind="${kind}"`,'danger')}</div>`;}
function renderArtist(){
  const list=state.content.artists;state.index=Math.min(state.index,Math.max(0,list.length-1));
  if(!list.length)return picker('artists')+'<div class="panel">Crea el primer artista.</div>';
  const p=`artists.${state.index}`;
  return picker('artists')+`<section class="panel"><h2>${esc(list[state.index].name)}</h2>${field('Nombre del artista',p+'.name')}${field('Género',p+'.genre')}${field('Biografía',p+'.description',{area:true})}${field('Identificador URL',p+'.id',{readonly:true})}${mediaField('Fotografía',p+'.image','image')}${field('Descripción de la fotografía',p+'.imageAlt')}${links(p+'.links','Enlaces del artista')}${reorder('artists')}</section>`;
}
function renderAlbum(){
  const list=state.content.albums;state.index=Math.min(state.index,Math.max(0,list.length-1));
  if(!list.length)return picker('albums')+'<div class="panel">El catálogo está vacío. Crea tu primer lanzamiento real.</div>';
  const p=`albums.${state.index}`,a=list[state.index];
  return picker('albums')+`<section class="panel"><h2>${esc(a.title)}</h2><div class="two-columns">${field('Título',p+'.title')}${field('Crédito artístico',p+'.artist')}${choice('Formato',p+'.type',[['album','Álbum'],['single','Single'],['ep','EP']])}${field('Fecha de lanzamiento',p+'.releaseDate',{type:'date'})}${field('Etiqueta de formato (LP, EP, Single)',p+'.label')}${choice('Estado público',p+'.status',[['Out Now','Publicado'],['Coming Soon','Próximamente'],['Archive','Archivo']])}</div><fieldset><legend>Artistas asociados</legend>${state.content.artists.map(artist=>`<label class="check"><input type="checkbox" data-associated="${artist.id}" ${a.artistIds.includes(artist.id)?'checked':''}>${esc(artist.name)}</label>`).join('')}</fieldset>${field('Identificador URL',p+'.id',{readonly:true})}${mediaField('Portada',p+'.cover','image')}${field('Descripción de la portada',p+'.coverAlt')}${links(p+'.platforms','Plataformas de streaming')}<section class="editor-group"><h3>Pistas</h3>${a.tracks.map((t,i)=>`<article class="track-editor"><h4>Pista ${i+1}</h4><div class="two-columns">${field('Título de pista',p+`.tracks.${i}.title`)}${field('Duración completa (min:seg, opcional)',p+`.tracks.${i}.duration`,{placeholder:'Pendiente'})}</div>${mediaField('Fragmento de escucha',p+`.tracks.${i}.previewUrl`,'audio')}<div class="toolbar">${button('↑','move-track',`data-index="${i}" data-direction="-1" aria-label="Subir pista ${i+1}"`)}${button('↓','move-track',`data-index="${i}" data-direction="1" aria-label="Bajar pista ${i+1}"`)}${button('Eliminar pista','delete-track',`data-index="${i}"`)}</div></article>`).join('')}${button('Añadir pista','add-track')}</section>${reorder('albums')}</section>`;
}
async function save(){validateContent(state.content);const d=await api('draft',{method:'POST',body:{content:state.content,version:state.version}});state.version=d.version;state.content=d.content;state.dirty=false;updateSaveStatus();say('Borrador guardado. La web pública no ha cambiado.');}
async function refreshMedia(){const m=await api('media');state.media=m.files;state.bytes=m.bytes;}
async function status(){const r=await api('status');state.publications=r.publications;if(state.section==='overview')render();return r;}
let statusTimer;
async function publish(){
  if(state.dirty)throw new Error('Guarda el borrador antes de publicar.');
  validateContent(state.content,{publishing:true});
  const p=await api('publish',{method:'POST',body:{version:state.version}});say('Publicando en Vercel. La web anterior seguirá disponible hasta que termine.');
  clearInterval(statusTimer);const start=Date.now();
  const check=async()=>{try{const r=await status();if(r.publications.some(v=>v.id===p.id&&v.state==='live')){clearInterval(statusTimer);say('Publicación completada. La nueva versión ya está disponible.');}else if(Date.now()-start>300000){clearInterval(statusTimer);say('La publicación todavía no se ha podido verificar. Comprueba su estado antes de reintentar.',true);}}catch(e){clearInterval(statusTimer);say(e.message,true);}};
  await check();statusTimer=setInterval(check,10000);
}
function preview(){
  const c=state.content;document.querySelector('#preview-content').innerHTML=`<p class="kicker">Vista previa privada · cambios del borrador</p><h1>${esc(c.site.brand)}</h1><p>${esc(c.site.tagline)}</p><h2>Lanzamientos</h2><div class="preview-grid">${c.albums.map(a=>`<article>${a.cover&&signed(a.cover)?`<img src="${esc(signed(a.cover))}" alt="${esc(a.coverAlt)}">`:''}<h3>${esc(a.title)}</h3><p>${esc(a.artist)} · ${esc(a.releaseDate)}</p>${a.tracks.map(t=>`<p>${esc(t.title)} · ${esc(t.duration)}</p>${t.previewUrl&&signed(t.previewUrl)?`<audio controls preload="none" src="${esc(signed(t.previewUrl))}"></audio>`:''}`).join('')}</article>`).join('')||'<p>New releases coming soon.</p>'}</div><h2>Artistas</h2><div class="preview-grid">${c.artists.map(a=>`<article>${a.image&&signed(a.image)?`<img src="${esc(signed(a.image))}" alt="${esc(a.imageAlt)}">`:''}<h3>${esc(a.name)}</h3><p>${esc(a.genre)}</p><p>${esc(a.description)}</p></article>`).join('')}</div>`;
  document.querySelector('#preview').showModal();
}
async function optimizeImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024)throw new Error('Selecciona una imagen JPEG, PNG o WebP de hasta 15 MB.');
  const image=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
  for(const quality of [.85,.75,.65,.5]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=IMAGE_LIMIT&&blob.type==='image/webp')return blob;}
  throw new Error('La imagen sigue superando 500 KB. Reduce su complejidad o tamaño.');
}
async function audioDuration(file){return await new Promise((resolve,reject)=>{const el=new Audio();const url=URL.createObjectURL(file);el.preload='metadata';const done=()=>{URL.revokeObjectURL(url);el.removeAttribute('src');};el.onloadedmetadata=()=>{const d=el.duration;done();if(!Number.isFinite(d)||d<=0||d>30.1)reject(new Error('El fragmento debe durar un máximo de 30 segundos.'));else resolve(d);};el.onerror=()=>{done();reject(new Error('No se pudo leer el MP3.'));};el.src=url;});}
app.addEventListener('input',e=>{
  const path=e.target.dataset.path;if(!path||e.target.tagName==='BUTTON'||e.target.readOnly)return;
  set(path,e.target.value);
  if(/^artists\.\d+\.name$/.test(path))for(const a of state.content.albums)if(a.artistIds.includes(state.content.artists[state.index].id))a.artist=a.artistIds.map(id=>state.content.artists.find(s=>s.id===id)?.name).filter(Boolean).join(', ');
});
app.addEventListener('change',e=>{
  if(e.target.dataset.picker){state.index=Number(e.target.value);render();}
  if(e.target.dataset.mediaChoice){set(e.target.dataset.path,e.target.value);render();}
  if(e.target.dataset.associated){const album=state.content.albums[state.index];album.artistIds=e.target.checked?[...album.artistIds,e.target.dataset.associated]:album.artistIds.filter(id=>id!==e.target.dataset.associated);album.artist=album.artistIds.map(id=>state.content.artists.find(a=>a.id===id).name).join(', ');state.dirty=true;render();}
  if(e.target.dataset.upload){const input=e.target,file=input.files?.[0];if(!file)return;run(async()=>{say('Preparando archivo…');let blob,duration=0;if(input.dataset.kind==='image')blob=await optimizeImage(file);else{if(!/\.mp3$/i.test(file.name)||file.size>AUDIO_LIMIT)throw new Error('Selecciona un MP3 de hasta 2 MB.');duration=await audioDuration(file);blob=new Blob([file],{type:'audio/mpeg'});}const m=await api('upload',{method:'POST',body:blob,headers:{'Content-Type':blob.type,'x-file-name':encodeURIComponent(file.name).slice(0,200),'x-audio-duration':String(duration)}});await refreshMedia();set(input.dataset.upload,m.path);render();say('Archivo añadido. Guarda el borrador para conservar la selección.');});}
});
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  run(async()=>{
    const action=b.dataset.action;
    if(action==='section'){state.section=b.dataset.section;state.index=0;render();return;}
    if(action==='save')return save();
    if(action==='publish')return publish();
    if(action==='retry-publication'){await api('retry-publication',{method:'POST',body:{id:b.dataset.id}});say('Publicación reintentada. Comprueba su estado en unos instantes.');return;}
    if(action==='configure-publishing'){const input=document.querySelector('#deploy-hook');await api('configure-publishing',{method:'POST',body:{hook:input.value.trim()}});input.value='';say('Conexión de publicación guardada.');return;}
    if(action==='preview')return preview();
    if(action==='logout'){if(state.dirty&&!confirm('Hay cambios sin guardar. ¿Cerrar sesión?'))return;clearInterval(statusTimer);await supabase.auth.signOut();state.session=null;state.content=null;renderLogin();return;}
    if(action==='refresh-media'){await refreshMedia();render();return;}
    if(action==='refresh-status'){await status();say('Estado actualizado.');return;}
    if(action==='restore'){if(!confirm('¿Recuperar esta versión como borrador? Los cambios sin guardar se perderán.'))return;await api('restore',{method:'POST',body:{id:b.dataset.id,version:state.version}});await load();say('Versión recuperada como borrador. Revisa y publica cuando esté lista.');return;}
    if(action==='delete-media'){if(!confirm('¿Eliminar este archivo? Solo se permite si ninguna versión conservada lo utiliza.'))return;await api('delete-media',{method:'POST',body:{path:b.dataset.path}});await refreshMedia();render();say('Archivo eliminado.');return;}
    if(action==='add-entry'){const list=state.content[b.dataset.kind],id=crypto.randomUUID().slice(0,8);list.push(b.dataset.kind==='artists'?{id:`artist-${id}`,name:'Nuevo artista',genre:'',description:'',image:'',imageAlt:'',links:[],joinedAt:new Date().toISOString().slice(0,10)}:{id:`release-${id}`,title:'Nuevo lanzamiento',artist:'',type:'single',label:'Single',status:'Out Now',releaseDate:new Date().toISOString().slice(0,10),cover:'',coverAlt:'',artistIds:[],platforms:[],tracks:[]});state.index=list.length-1;}
    if(action==='delete-entry'){const kind=b.dataset.kind,item=state.content[kind][state.index];if(kind==='artists'&&state.content.albums.some(a=>a.artistIds.includes(item.id)))throw new Error('Desasocia este artista de sus lanzamientos antes de eliminarlo.');if(!confirm(`¿Eliminar ${item.name||item.title} del borrador?`))return;if(kind==='albums'&&state.content.site.featuredReleaseId===item.id)state.content.site.featuredReleaseId='';state.content[kind].splice(state.index,1);state.index=Math.max(0,state.index-1);}
    if(action==='move-entry'){const list=state.content[b.dataset.kind],next=state.index+Number(b.dataset.direction);if(next<0||next>=list.length)return;[list[state.index],list[next]]=[list[next],list[state.index]];state.index=next;}
    if(action==='add-link')get(b.dataset.path).push({label:'',url:''});
    if(action==='remove-link')get(b.dataset.path).splice(Number(b.dataset.index),1);
    if(action==='add-track')state.content.albums[state.index].tracks.push({id:`track-${crypto.randomUUID().slice(0,8)}`,title:'Nueva pista',duration:'',previewUrl:''});
    if(action==='delete-track'){if(!confirm('¿Eliminar esta pista del borrador?'))return;state.content.albums[state.index].tracks.splice(Number(b.dataset.index),1);}
    if(action==='move-track'){const list=state.content.albums[state.index].tracks,i=Number(b.dataset.index),j=i+Number(b.dataset.direction);if(j<0||j>=list.length)return;[list[i],list[j]]=[list[j],list[i]];}
    state.dirty=true;render();
  });
});
document.querySelector('#close-preview').addEventListener('click',()=>document.querySelector('#preview').close());
document.addEventListener('play',e=>{if(e.target.tagName==='AUDIO')document.querySelectorAll('audio').forEach(a=>{if(a!==e.target)a.pause();});},true);
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
supabase.auth.onAuthStateChange((_event,session)=>{state.session=session;if(!session&&state.content){clearInterval(statusTimer);say('La sesión ha terminado. Inicia sesión para continuar.',true);renderLogin();}});
if(activation)renderActivation();else run(async()=>{const {data}=await supabase.auth.getSession();state.session=data.session;if(state.session)await load();else renderLogin();});
