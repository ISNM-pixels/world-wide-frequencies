import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, referencedMedia, ADMIN_EMAIL } from '../lib/content.mjs';
const source=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url)));
test('empty catalog retains artists and both contact addresses',()=>{
  assert.equal(validateContent(structuredClone(source),{publishing:true}).albums.length,0);
  assert.equal(source.artists.length,7);
  assert.equal(source.site.contact.email,'contact@worldwidefrequencies.com');
  assert.equal(source.site.contact.supportEmail,'support@worldwidefrequencies.com');
  assert.equal(ADMIN_EMAIL,'imagesoundandmedia@tutamail.com');
});
test('publication rejects incomplete releases and unknown artist associations',()=>{
  const c=structuredClone(source);c.albums=[{id:'test',title:'Test',artist:'Artist',type:'single',releaseDate:'2026-11-05',artistIds:[],platforms:[],tracks:[],cover:''}];
  assert.doesNotThrow(()=>validateContent(c));
  assert.throws(()=>validateContent(c,{publishing:true}));
  c.albums[0].artistIds=['not-a-real-artist'];assert.throws(()=>validateContent(c));
});
test('content rejects executable URLs and arbitrary media paths',()=>{
  const c=structuredClone(source);c.artists[0].links=[{label:'Unsafe',url:'javascript:alert(1)'}];
  assert.throws(()=>validateContent(c));c.artists[0].links=[];
  c.artists[0].image='../../server.mjs';assert.throws(()=>validateContent(c));
});
test('only media used by the draft is retained in its manifest',()=>{
  const c=structuredClone(source);const image=`media/${'a'.repeat(64)}.webp`;c.artists[0].image=image;c.artists[1].image=image;
  assert.deepEqual(referencedMedia(c),[image]);
});
test('admin and public output contain no private keys or original demonstration material',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/World Wide<br>Frequencies/);assert.match(html,/New releases coming soon/);
  assert.doesNotMatch(html,/Synaptic Echoes|Voidwalker|Kryptic/);
  const demo=await readFile(new URL('../dist/demos.html',import.meta.url),'utf8');
  assert.doesNotMatch(demo,/Demo mode|demonstration|not delivered|trial runs|not being received/);
  const client=await readFile(new URL('../dist/script.js',import.meta.url),'utf8');
  assert.match(client,/Demo submitted successfully\./);assert.doesNotMatch(client,/simulation complete/);
  const admin=await readFile(new URL('../dist/admin/app.js',import.meta.url),'utf8');
  assert.equal(/sb_secret_[A-Za-z0-9_-]{20,}|bootstrap_hash|build_hash/.test(admin),false);
});
