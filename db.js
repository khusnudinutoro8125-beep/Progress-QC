/* Cache layer: localStorage (master kecil + outbox) + IndexedDB (part 50rb) + pengiriman anti-nyangkut */
const SMALL_KEY='qc_small_masters_v1', OUTBOX_KEY='qc_outbox_v1';
function cacheSetSmall(d){ try{ localStorage.setItem(SMALL_KEY,JSON.stringify(d)); }catch(e){} }
function cacheGetSmall(){ try{ return JSON.parse(localStorage.getItem(SMALL_KEY)||'null'); }catch(e){ return null; } }
function outboxAll(){ try{ return JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]'); }catch(e){ return []; } }
function outboxSave(a){ try{ localStorage.setItem(OUTBOX_KEY,JSON.stringify(a)); }catch(e){} }
function outboxAdd(i){ const a=outboxAll(); a.push(i); outboxSave(a); }
function outboxUpdate(id,patch){ outboxSave(outboxAll().map(x=>x.id===id?Object.assign(x,patch):x)); }
function outboxRemove(id){ outboxSave(outboxAll().filter(x=>x.id!==id)); }
/* Reset status "sending" yang tersisa dari sesi sebelumnya -> jadi bisa diproses lagi */
function outboxResetSending(){ outboxSave(outboxAll().map(x=> x.status==='sending' ? Object.assign(x,{status:'pending'}) : x )); }
function uuid(){ return 's-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

/* ---- IndexedDB Master Part ---- */
const IDB_NAME='qc_master_db', IDB_VER=1;
function idbOpen(){ return new Promise((res,rej)=>{ const r=indexedDB.open(IDB_NAME,IDB_VER);
  r.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('parts')) db.createObjectStore('parts',{keyPath:'pn'}); if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
  r.onsuccess=e=>res(e.target.result); r.onerror=e=>rej(e.target.error); }); }
async function idbPutParts(list){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction('parts','readwrite'); const st=tx.objectStore('parts'); list.forEach(p=>st.put(p)); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); }); }
async function idbDeleteParts(pns){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction('parts','readwrite'); const st=tx.objectStore('parts'); pns.forEach(pn=>st.delete(pn)); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); }); }
async function idbGetPart(pn){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction('parts','readonly').objectStore('parts').get(pn); r.onsuccess=()=>res(r.result||null); r.onerror=e=>rej(e.target.error); }); }
async function idbCountParts(){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction('parts','readonly').objectStore('parts').count(); r.onsuccess=()=>res(r.result); r.onerror=e=>rej(e.target.error); }); }
async function idbMetaGet(k){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction('meta','readonly').objectStore('meta').get(k); r.onsuccess=()=>res(r.result); r.onerror=e=>rej(e.target.error); }); }
async function idbMetaSet(k,v){ const db=await idbOpen(); return new Promise((res,rej)=>{ const tx=db.transaction('meta','readwrite'); tx.objectStore('meta').put(v,k); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); }); }

async function syncPartsMaster(onProgress){
  const meta=await jsonp({action:'getPartsMeta'},20000); if(meta.status!=='success') return;
  const serverStamp=meta.data.stamp, total=meta.data.count;
  const localCount=await idbCountParts(); const lastSync=await idbMetaGet('lastSync');
  if(localCount===0 || !lastSync){
    const size=2000, pages=Math.ceil(total/size), start=new Date().toISOString();
    for(let pg=0; pg<pages; pg++){
      const res=await jsonp({action:'getPartsPage',page:pg,size},30000);
      if(res.status==='success'){ await idbPutParts(res.data.parts); if(onProgress) onProgress(Math.min(total,(pg+1)*size),total); }
    }
    await idbMetaSet('lastSync',start); await idbMetaSet('stamp',serverStamp||''); return;
  }
  const localStamp=await idbMetaGet('stamp');
  if((serverStamp||'')!==(localStamp||'')){
    const res=await jsonp({action:'syncParts',since:lastSync},40000);
    if(res.status==='success'){
      if(res.data.upserts.length) await idbPutParts(res.data.upserts);
      if(res.data.deletes.length) await idbDeleteParts(res.data.deletes);
      await idbMetaSet('lastSync',res.data.now); await idbMetaSet('stamp',serverStamp||'');
    }
  }
}

/* ---- Pengiriman: 1 percobaan (timeout 10 dtk) + verifikasi by ID ---- */
async function verifyId(submitId){
  try{ const r=await jsonp({action:'checkId',submitId},8000); return !!(r&&r.status==='success'&&r.data&&r.data.exists); }catch(e){ return false; }
}
async function deliver(item){
  const d=item.data;
  const tmo=(typeof SEND_TIMEOUT_MS!=='undefined')?SEND_TIMEOUT_MS:10000;
  try{
    const res=await jsonp({action:'submit',submitId:item.submitId,tujuan:d.tujuan,tanggal:d.tanggal,partNumber:d.partNumber,qty:d.qty,posisi:d.posisi}, tmo);
    if(res && res.status==='success') return true;        // termasuk duplicate = sukses
    throw new Error(res&&res.message?res.message:'Gagal simpan.');
  }catch(e){
    // tak yakin -> cek apakah data sebenarnya sudah masuk
    if(await verifyId(item.submitId)) return true;
    throw e;
  }
}