import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { readFile, readdir, stat, mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const dist = path.join(root,'dist');
const data = JSON.parse(await readFile(path.join(root,'data/content.json'),'utf8'));
async function files(dir){const list=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())list.push(...await files(name));else list.push(name);}return list;}
const htmlFiles=(await files(dist)).filter(f=>f.endsWith('.html') && !f.includes(path.sep+'admin'+path.sep));

test('all original routes and generated release routes exist with static content',async()=>{
  for(const route of ['index','artists','releases','contact','about','demos','404']) assert.ok((await stat(path.join(dist,route+'.html'))).isFile());
  for(const artist of data.artists) assert.ok((await readFile(path.join(dist,'artists',artist.id+'.html'),'utf8')).includes(artist.name));
  for(const album of data.albums) {
    const page=await readFile(path.join(dist,'releases',album.id+'.html'),'utf8');
    assert.ok(page.includes(album.title));
    for(const track of album.tracks)assert.ok(page.includes(track.title));
  }
  assert.equal(htmlFiles.length,7 + data.artists.length + data.albums.length);
});
test('generated pages have real metadata and no broken internal links or placeholders',async()=>{
  for(const filename of htmlFiles){
    const html=await readFile(filename,'utf8');
    assert.match(html,/<html lang="en">/);assert.match(html,/<meta name="description"/);
    assert.match(html,/<link rel="canonical" href="https:\/\/world-wide-frequencies.vercel.app/);
    assert.match(html,/property="og:image"/);assert.doesNotMatch(html,/href="#"/);
    assert.doesNotMatch(html,/href="\/[^"#]*\.html(?:["?#])/);
    assert.doesNotMatch(html,/<(?:link rel="canonical"|meta property="og:url")[^>]*\.html/);
    for(const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)){
      const route=new URL(match[1],'https://example.test').pathname;
      const target=route==='/'?'/index.html':path.extname(route)?route:route+'.html';
      assert.ok((await stat(path.join(dist,target))).isFile(),`${filename}: ${target}`);
    }
  }
});
test('missing preview and platform data produce honest non-interactive states',async()=>{
  for(const album of data.albums){
    const html=await readFile(path.join(dist,'releases',album.id+'.html'),'utf8');
    if(album.tracks.some(t=>!t.previewUrl)) assert.match(html,/Preview coming soon/);
    if(!album.platforms.length) assert.match(html,/Streaming links will be added here/);
    if(album.tracks.every(t=>!t.previewUrl)) assert.doesNotMatch(html,/data-preview="/);
  }
  for(const artist of data.artists.filter(artist=>!data.albums.some(a=>a.artistIds.includes(artist.id)))) {
    const profile=await readFile(path.join(dist,'artists',artist.id+'.html'),'utf8');
    assert.match(profile,/Releases for this artist will appear here/);
  }
});
test('distribution excludes source, tests and QA files; sitemap covers public pages',async()=>{
  for(const file of ['package.json','server.mjs','CONTENT_EDITING_GUIDE.md','scripts','tests','.qa','.git'])await assert.rejects(stat(path.join(dist,file)));
  const sitemap=await readFile(path.join(dist,'sitemap.xml'),'utf8');
  assert.equal([...sitemap.matchAll(/<loc>/g)].length,6 + data.artists.length + data.albums.length);assert.ok(!sitemap.includes('404.html'));
  assert.ok(!sitemap.includes('.html'));
  const published=JSON.parse(await readFile(path.join(dist,'data/content.json'),'utf8'));
  for(const artist of published.artists)assert.equal(artist.profileUrl,`/artists/${artist.id}`);
  assert.ok((await stat(path.join(dist,'assets/images/social-card.png'))).size>1000);
});
test('prepare isolated media fixtures and verify optional streaming/artist relationships',async()=>{
  const fixture=path.join(root,'.qa','source');
  await mkdir(fixture,{recursive:true});
  for(const item of ['scripts','assets','styles.css','script.js','admin','lib','supabase'])await cp(path.join(root,item),path.join(fixture,item),{recursive:true});
  const clone=structuredClone(data);
  clone.albums=[{id:'qa-release',title:'QA Release',artist:'QA Artist',type:'album',label:'LP',status:'Out Now',releaseDate:'2026-01-01',cover:'assets/images/placeholder.svg',coverAlt:'QA artwork',artistIds:[],platforms:[],tracks:[{id:'first',title:'First',duration:'4:00',previewUrl:''},{id:'second',title:'Second',duration:'3:00',previewUrl:''},{id:'third',title:'Third',duration:'2:00',previewUrl:''}]}];
  clone.artists=[{id:'qa-artist',name:'QA Artist',profileUrl:'/artists/qa-artist.html',genre:'Test',description:'',image:'',imageAlt:'',links:[]}];
  const media=path.join(fixture,'assets/audio');await mkdir(media,{recursive:true});
  function wav(seconds){const rate=8000,n=rate*seconds;const buffer=Buffer.alloc(44+n*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)buffer.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*220*i/rate)),44+i*2);return buffer;}
  await writeFile(path.join(media,'qa-preview.wav'),wav(25));await writeFile(path.join(media,'qa-short.wav'),wav(2));
  clone.albums[0].tracks[0].previewUrl='assets/audio/qa-preview.wav';
  clone.albums[0].tracks[1].previewUrl='assets/audio/qa-short.wav';
  clone.albums[0].tracks[2].previewUrl='http://127.0.0.1:5174/missing-audio.wav';
  clone.albums[0].platforms=[{label:'Spotify',url:'https://open.spotify.com/'},{label:'Invalid',url:'javascript:alert(1)'},{label:'Tidal',url:'https://tidal.com/'}];
  clone.albums[0].artistIds=['qa-artist'];
  await mkdir(path.join(fixture,'data'),{recursive:true});await writeFile(path.join(fixture,'data/content.json'),JSON.stringify(clone));
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:fixture});
  const html=await readFile(path.join(fixture,'dist/releases/qa-release.html'),'utf8');
  assert.equal([...html.matchAll(/data-preview="/g)].length,3);
  assert.match(html,/target="_blank" rel="noopener noreferrer">Spotify/);assert.doesNotMatch(html,/javascript:alert/);
  assert.match(html,/href="\/artists\/qa-artist">QA Artist/);
  assert.match(html,/<link rel="canonical" href="https:\/\/world-wide-frequencies.vercel.app\/releases\/qa-release"/);
  const published=JSON.parse(await readFile(path.join(fixture,'dist/data/content.json'),'utf8'));
  assert.equal(published.artists[0].profileUrl,'/artists/qa-artist');
  const queue=JSON.parse(html.match(/id="preview-data" type="application\/json">(.*?)<\/script>/s)[1]);assert.equal(queue.length,3);
  // Browser QA uses this isolated output. Never copy fixture media to production dist.
  await cp(path.join(fixture,'dist'),path.join(root,'.qa/site'),{recursive:true});
});

test('local server serves clean routes and redirects old links without losing queries',async t=>{
  const child=spawn(process.execPath,['server.mjs','.qa/source/dist'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  const origin=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Local server did not start')),10000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
  });
  for(const route of ['/','/releases','/artists','/about','/contact','/demos','/artists/qa-artist','/releases/qa-release','/admin']){
    const response=await fetch(origin+route,{redirect:'manual'});
    assert.equal(response.status,200,route);assert.match(response.headers.get('content-type'),/text\/html/);
  }
  for(const [old,clean] of [['/index.html','/'],['/index','/'],['/artists.html','/artists'],['/artists/qa-artist.html','/artists/qa-artist'],['/releases/qa-release.html','/releases/qa-release'],['/contact/','/contact'],['/admin/','/admin'],['/admin/index.html','/admin']]){
    const response=await fetch(origin+old+'?from=saved%20link',{redirect:'manual'});
    assert.equal(response.status,308,old);assert.equal(response.headers.get('location'),clean+'?from=saved%20link');
  }
  assert.equal((await fetch(origin+'/missing-page')).status,404);
  assert.equal((await fetch(origin+'/missing-artist.html')).status,404);
  const encodedSlashes=await fetch(origin+'/%2fexample.com.html',{redirect:'manual'});
  assert.equal(encodedSlashes.status,308);assert.equal(encodedSlashes.headers.get('location'),'/example.com');
  assert.equal((await fetch(origin+'/styles.css')).status,200);
  const partial=await fetch(origin+'/assets/audio/qa-preview.wav',{headers:{Range:'bytes=0-43'}});
  assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,44);
});
