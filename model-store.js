const database = new Promise((resolve,reject)=>{
  const r=indexedDB.open('ZyBooksAutoUltraPrivate',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
});
async function read(key){const db=await database;return new Promise((resolve,reject)=>{const r=db.transaction('settings').objectStore('settings').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function write(key,value){const db=await database;return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
let keyPromise;
function encryptionKey(){
  if(!keyPromise)keyPromise=(async()=>{
    const old=await read('credential-key');if(old)return old;
    const fresh=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),db=await database;
    // A transaction resolves concurrent Models tabs to the same non-extractable key.
    return new Promise((resolve,reject)=>{const tx=db.transaction('settings','readwrite'),store=tx.objectStore('settings'),r=store.get('credential-key');let key;r.onsuccess=()=>{key=r.result||fresh;if(!r.result)store.put(key,'credential-key');};tx.oncomplete=()=>resolve(key);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  })();return keyPromise;
}
export async function getPrivate(key,fallback){
  const value=await read(key);if(value==null)return fallback;
  if(key==='cards'&&value.encrypted===1){const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:value.iv},await encryptionKey(),value.cipher);return JSON.parse(new TextDecoder().decode(bytes));}
  // Migrate existing model cards (including API keys) to encrypted storage on first read.
  if(key==='cards'&&Array.isArray(value))await setPrivate(key,value);
  return value;
}
export async function setPrivate(key,value){
  if(key==='cards'){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),new TextEncoder().encode(JSON.stringify(value)));return write(key,{encrypted:1,iv,cipher});}
  return write(key,value);
}
