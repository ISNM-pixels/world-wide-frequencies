import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, stat, mkdir, cp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
const dist = path.join(root,'dist');
const data = JSON.parse(await readFile(path.join(root,'data/content.json'),'utf8'));
async function files(dir){const list=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isDirectory())list.push(...await files(name));else list.push(name);}return list;}
const htmlFiles=(await files(dist)).filter(f=>f.endsWith('.html'));

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
    for(const match of html.matchAll(/(?:href|src)="(\/[^"#]*)"/g)){
      const target=match[1]==='/index.html'?'/index.html':match[1];
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
  assert.ok((await stat(path.join(dist,'assets/images/social-card.png'))).size>1000);
});
test('prepare isolated media fixtures and verify optional streaming/artist relationships',async()=>{
  const fixture=path.join(root,'.qa','source');
  await mkdir(fixture,{recursive:true});
  for(const item of ['scripts','assets','styles.css','script.js'])await cp(path.join(root,item),path.join(fixture,item),{recursive:true});
  const clone=structuredClone(data);
  const media=path.join(fixture,'assets/audio');await mkdir(media,{recursive:true});
  function wav(seconds){const rate=8000,n=rate*seconds;const buffer=Buffer.alloc(44+n*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);for(let i=0;i<n;i++)buffer.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*220*i/rate)),44+i*2);return buffer;}
  await writeFile(path.join(media,'qa-preview.wav'),wav(25));await writeFile(path.join(media,'qa-short.wav'),wav(2));
  clone.albums[0].tracks[0].previewUrl='assets/audio/qa-preview.wav';
  clone.albums[0].tracks[1].previewUrl='assets/audio/qa-short.wav';
  clone.albums[0].tracks[2].previewUrl='http://127.0.0.1:5174/missing-audio.wav';
  clone.albums[0].platforms=[{label:'Spotify',url:'https://open.spotify.com/'},{label:'Invalid',url:'javascript:alert(1)'},{label:'Tidal',url:'https://tidal.com/'}];
  clone.albums[0].artistIds=['jeremy-blake'];
  await mkdir(path.join(fixture,'data'),{recursive:true});await writeFile(path.join(fixture,'data/content.json'),JSON.stringify(clone));
  execFileSync(process.execPath,['scripts/build.mjs'],{cwd:fixture});
  const html=await readFile(path.join(fixture,'dist/releases/synaptic-echoes.html'),'utf8');
  assert.equal([...html.matchAll(/data-preview="/g)].length,3);
  assert.match(html,/target="_blank" rel="noopener noreferrer">Spotify/);assert.doesNotMatch(html,/javascript:alert/);
  assert.match(html,/href="\/artists\/jeremy-blake.html">Jeremy Blake/);
  const queue=JSON.parse(html.match(/id="preview-data" type="application\/json">(.*?)<\/script>/s)[1]);assert.equal(queue.length,3);
  // Browser QA uses this isolated output. Never copy fixture media to production dist.
  await cp(path.join(fixture,'dist'),path.join(root,'.qa/site'),{recursive:true});
});
