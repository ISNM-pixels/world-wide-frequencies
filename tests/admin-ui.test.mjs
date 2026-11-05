import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

const html=await readFile(new URL('../admin/index.html',import.meta.url),'utf8');
const bundle=await readFile(new URL('../dist/admin/app.js',import.meta.url),'utf8');
const content=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url)));
const settle=()=>new Promise(resolve=>setTimeout(resolve,50));
function page({authenticated=false}={}){
  const window=new Window({url:'https://world-wide-frequencies.vercel.app/admin/',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.crypto=globalThis.crypto;
  window.AbortSignal=globalThis.AbortSignal;
  window.document.write(html);let draft=structuredClone(content),version=1;const requests=[];
  if(authenticated){
    const payload=Buffer.from(JSON.stringify({sub:'test-owner',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
    window.sessionStorage.setItem('sb-slnrpuaqjdvrodahgzbr-auth-token',JSON.stringify({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,refresh_token:'test-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-owner',email:'imagesoundandmedia@tutamail.com'}}));
  }
  window.fetch=async(url,options={})=>{
    const action=new URL(url).searchParams.get('action');requests.push({action,method:options.method||'GET'});
    let result={};
    if(action==='draft'){
      if(options.method==='POST'){const body=JSON.parse(options.body);draft=body.content;version++;}
      result={content:draft,version,media:[]};
    }else if(action==='media')result={files:[],bytes:0,limit:50*1024*1024};
    else if(action==='status')result={publications:[]};
    else if(String(url).includes('/auth/'))result={error:'Invalid credentials',error_description:'Invalid credentials'};
    return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  };
  window.confirm=()=>true;
  window.eval(bundle);
  return {window,document:window.document,requests,getDraft:()=>draft};
}
test('private panel initially presents login without loading catalog',async()=>{
  const p=page();await settle();assert.ok(p.document.querySelector('#login'));assert.equal(p.requests.filter(r=>r.action==='draft').length,0);
  await p.window.happyDOM.close();
});
test('authenticated editor creates an artist and saves only a draft',async()=>{
  const p=page({authenticated:true});await settle();await settle();
  assert.ok(p.document.querySelector('.workspace'));
  p.document.querySelector('[data-section="artists"]').click();await settle();
  p.document.querySelector('[data-action="add-entry"]').click();await settle();
  const name=p.document.querySelector('[data-path="artists.7.name"]');assert.ok(name);name.value='UI Test Artist';name.dispatchEvent(new p.window.Event('input',{bubbles:true}));
  p.document.querySelector('[data-action="save"]').click();await settle();await settle();
  assert.equal(p.getDraft().artists.at(-1).name,'UI Test Artist');assert.equal(p.requests.filter(r=>r.action==='publish').length,0);
  await p.window.happyDOM.close();
});
test('activation link presents password setup instead of the normal login',async()=>{
  const window=new Window({url:'https://world-wide-frequencies.vercel.app/admin/#activate=local-test-token',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  window.crypto=globalThis.crypto;window.document.write(html);window.eval(bundle);await settle();
  assert.ok(window.document.querySelector('#activate'));assert.equal(window.location.hash,'');assert.equal(window.document.querySelectorAll('[type="password"]').length,2);
  await window.happyDOM.close();
});
