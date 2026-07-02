const el=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function shortDate(iso){ if(!iso) return ''; const p=String(iso).split('-'); if(p.length!==3) return iso; return parseInt(p[2],10)+'-'+parseInt(p[1],10)+'-'+String(p[0]).slice(2); }

/* ---- IndexedDB khusus packing (kunci = submitId) ---- */
const PDB='qc_packing_db', PVER=1;
function pOpen(){ return new Promise((res,rej)=>{ const r=indexedDB.open(PDB,PVER);
  r.onupgradeneeded=e=>{ const db=e.target.result; if(!db.objectStoreNames.contains('rows')) db.createObjectStore('rows',{keyPath:'submitId'}); if(!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
  r.onsuccess=e=>res(e.target.result); r.onerror=e=>rej(e.target.error); }); }
function pPut(list){ return pOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('rows','readwrite'); const st=tx.objectStore('rows'); list.forEach(x=>{ if(x.submitId) st.put(x); }); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); })); }
function pDel(ids){ return pOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('rows','readwrite'); const st=tx.objectStore('rows'); ids.forEach(id=>st.delete(id)); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); })); }
function pAll(){ return pOpen().then(db=>new Promise((res,rej)=>{ const r=db.transaction('rows','readonly').objectStore('rows').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=e=>rej(e.target.error); })); }
function pClear(){ return pOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('rows','readwrite'); tx.objectStore('rows').clear(); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); })); }
function pMetaGet(k){ return pOpen().then(db=>new Promise((res,rej)=>{ const r=db.transaction('meta','readonly').objectStore('meta').get(k); r.onsuccess=()=>res(r.result); r.onerror=e=>rej(e.target.error); })); }
function pMetaSet(k,v){ return pOpen().then(db=>new Promise((res,rej)=>{ const tx=db.transaction('meta','readwrite'); tx.objectStore('meta').put(v,k); tx.oncomplete=()=>res(); tx.onerror=e=>rej(e.target.error); })); }

let ROWS=[];
let sortState={col:'tanggal',dir:'desc'};
let toEdited=false;

function showSync(t){ el('syncText').textContent=t; el('syncBar').classList.remove('hidden'); }
function hideSync(){ el('syncBar').classList.add('hidden'); }
function setUpdated(){ el('updated').textContent='Diperbarui '+new Date().toLocaleTimeString('id-ID'); }

function fillTujuan(list){ const cur=el('fTujuan').value; el('fTujuan').innerHTML='<option value="">Semua tujuan</option>'+list.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join(''); if(cur) el('fTujuan').value=cur; }

/* ---- Render ---- */
function cmp(a,b,col){
  if(col==='qty') return (parseFloat(a.qty)||0)-(parseFloat(b.qty)||0);
  if(col==='tanggal') return String(a.tanggal).localeCompare(String(b.tanggal)); // yyyy-mm-dd => kronologis
  return String(a[col]||'').localeCompare(String(b[col]||''),'id',{numeric:true});
}
function headRow(){
  const cols=[['tanggal','Tanggal'],['partNumber','Part Number'],['partName','Part Name'],['qty','Qty'],['posisi','Posisi']];
  return '<tr>'+cols.map(c=>{
    const active=sortState.col===c[0]; const arrow=active?(sortState.dir==='asc'?' ▲':' ▼'):'';
    const cls=c[0]==='qty'?' class="num"':'';
    return '<th'+cls+' data-col="'+c[0]+'" style="cursor:pointer;user-select:none">'+esc(c[1])+arrow+'</th>';
  }).join('')+'</tr>';
}
function currentRows(){
  const ft=el('fTujuan').value, fp=el('fPart').value.trim().toLowerCase();
  let from=el('fFrom').value, to=el('fTo').value; if(from&&to&&to<from){ const t=from; from=to; to=t; }
  return ROWS.filter(r=>{
    if(!r.submitId) return false;
    if(ft && r.tujuan!==ft) return false;
    if(from && (!r.tanggal || r.tanggal<from)) return false;
    if(to && (!r.tanggal || r.tanggal>to)) return false;
    if(fp && String(r.partNumber).toLowerCase().indexOf(fp)<0) return false;
    return true;
  });
}
function sortRows(rows){ const s=rows.slice().sort((a,b)=>cmp(a,b,sortState.col)); if(sortState.dir==='desc') s.reverse(); return s; }
function render(){
  const rows=currentRows(); const g={};
  rows.forEach(r=>{ const k=r.tujuan||'(tanpa tujuan)'; (g[k]=g[k]||[]).push(r); });
  const keys=Object.keys(g).sort();
  el('summary').textContent=rows.length+' item • '+keys.length+' tujuan';
  if(!rows.length){ el('results').innerHTML='<div class="empty">Tidak ada data.</div>'; return; }
  el('results').innerHTML=keys.map(tj=>{
    const body=sortRows(g[tj]).map(r=>'<tr><td data-l="Tanggal">'+esc(shortDate(r.tanggal))+'</td><td data-l="Part Number"><b>'+esc(r.partNumber)+'</b></td><td data-l="Part Name">'+esc(r.partName)+'</td><td data-l="Qty" class="num">'+esc(r.qty)+'</td><td data-l="Posisi">'+esc(r.posisi)+'</td></tr>').join('');
    return '<section class="group card"><div class="group-head"><h2>'+esc(tj)+'</h2><span class="badge">'+g[tj].length+' item</span></div><div class="table-wrap"><table><thead>'+headRow()+'</thead><tbody>'+body+'</tbody></table></div></section>';
  }).join('');
}

/* ---- Sinkron data ---- */
async function fullLoad(){
  showSync('Memuat data packing…');
  try{
    const meta=await jsonp({action:'getDataMeta'},15000);
    const r=await jsonp({action:'getAllData'},30000);
    if(r.status==='success'){
      await pClear(); await pPut(r.data.rows);
      await pMetaSet('lastSync', r.data.now);
      await pMetaSet('stamp', meta.status==='success'?(meta.data.stamp||''):'');
      ROWS=await pAll(); render(); setUpdated();
    }
  }catch(e){ toast('Gagal memuat penuh.','error'); }
  hideSync();
}
async function poll(){
  try{
    const meta=await jsonp({action:'getDataMeta'},10000); if(meta.status!=='success') return;
    const localStamp=await pMetaGet('stamp');
    if((meta.data.stamp||'')!==(localStamp||'')){
      const since=await pMetaGet('lastSync');
      const r=await jsonp({action:'syncData',since:since||''},25000);
      if(r.status==='success'){
        if(r.data.rows.length) await pPut(r.data.rows);
        await pMetaSet('lastSync', r.data.now);
        await pMetaSet('stamp', meta.data.stamp||'');
        ROWS=await pAll(); render(); setUpdated();
      }
    }
  }catch(e){}
}
async function reconcile(){
  try{
    const r=await jsonp({action:'getAllIds'},20000); if(r.status!=='success') return;
    const server=new Set(r.data.ids);
    const stale=ROWS.map(x=>x.submitId).filter(id=>id && !server.has(id));
    if(stale.length){ await pDel(stale); ROWS=await pAll(); render(); }
  }catch(e){}
}

/* ---- Event ---- */
el('results').addEventListener('click',e=>{
  const th=e.target.closest && e.target.closest('th[data-col]'); if(!th) return;
  const col=th.getAttribute('data-col');
  if(sortState.col===col) sortState.dir=sortState.dir==='asc'?'desc':'asc';
  else { sortState.col=col; sortState.dir='asc'; }
  render();
});
el('fFrom').addEventListener('input',()=>{ if(!toEdited || !el('fTo').value) el('fTo').value=el('fFrom').value; render(); });
el('fTo').addEventListener('input',()=>{ toEdited=true; render(); });
el('fPart').addEventListener('input',render);
el('fTujuan').addEventListener('change',render);
el('clearFilter').addEventListener('click',()=>{ el('fFrom').value=''; el('fTo').value=''; el('fPart').value=''; el('fTujuan').value=''; toEdited=false; render(); });
el('fullReload').addEventListener('click', fullLoad);

document.addEventListener('DOMContentLoaded', async()=>{
  const c=cacheGetSmall(); if(c) fillTujuan(c.tujuan);
  jsonp({action:'getMasters'},15000).then(r=>{ if(r.status==='success'){ fillTujuan(r.data.tujuan); cacheSetSmall(r.data); } }).catch(()=>{});
  ROWS=await pAll(); render();           // tampil instan dari cache
  if(!ROWS.length) await fullLoad();      // unduh penuh hanya jika kosong
  setUpdated();
  setInterval(poll, PACKING_REFRESH_MS);
  setInterval(reconcile, RECONCILE_MS);
  reconcile();
});
