const el=id=>document.getElementById(id);
let SMALL={tujuan:[],posisi:[]};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function todayLocal(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
function sortAZ(a){ return (a||[]).slice().sort((x,y)=>{ x=String(x).toUpperCase(); y=String(y).toUpperCase(); return x<y?-1:x>y?1:0; }); }
function normUp(s){ return String(s||'').trim().replace(/\s+/g,' ').toUpperCase(); }
function fillDatalist(listId,items){ const dl=el(listId); if(!dl) return; dl.innerHTML=(items||[]).map(v=>'<option value="'+esc(v)+'"></option>').join(''); }
function applySmall(){ fillDatalist('tujuanList',SMALL.tujuan); fillDatalist('posisiList',SMALL.posisi); }

let lastSmallJson='';
async function refreshSmall(){
  try{
    const r=await jsonp({action:'getMasters'},15000);
    if(r.status==='success'){
      const data={ tujuan:sortAZ(r.data.tujuan), posisi:sortAZ(r.data.posisi) };
      const j=JSON.stringify(data);
      if(j!==lastSmallJson){ SMALL=data; lastSmallJson=j; cacheSetSmall(SMALL); applySmall(); }
    }
  }catch(e){}
}

let syncing=false;
async function syncBg(){
  if(syncing) return; syncing=true;
  try{
    const first=(await idbCountParts())===0;
    if(first){ el('syncBar').classList.remove('hidden');
      await syncPartsMaster((d,t)=>{ el('syncText').textContent='Mengunduh master part… '+d+'/'+t; el('syncFill').style.width=(t?Math.round(d/t*100):100)+'%'; });
      el('syncBar').classList.add('hidden');
    } else { await syncPartsMaster(); }
  }catch(e){ el('syncBar').classList.add('hidden'); } finally{ syncing=false; }
}

let pnTimer;
el('partNumber').addEventListener('input',()=>{
  clearTimeout(pnTimer); const pn=el('partNumber').value.trim(); const p=el('partNamePreview');
  if(!pn){ p.textContent='—'; p.className='hint'; return; }
  pnTimer=setTimeout(async()=>{ const it=await idbGetPart(pn);
    if(it){ p.textContent=it.name||'(tanpa nama)'; p.className='hint ok'; } else { p.textContent='Part number tidak ada di master'; p.className='hint warn'; } },120);
});

/* Popup konfirmasi mandiri (tidak bergantung file lain) */
function askConfirm(htmlMsg){
  return new Promise(res=>{
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    const box=document.createElement('div');
    box.style.cssText='background:#fff;border-radius:14px;max-width:340px;width:100%;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.25);';
    box.innerHTML='<div style="font-size:15px;line-height:1.5;color:#14213d;margin-bottom:18px;">'+htmlMsg+'</div>'+
      '<div style="display:flex;gap:10px;justify-content:flex-end;">'+
      '<button type="button" id="_no" style="padding:10px 16px;border:1px solid #d0d5dd;background:#fff;border-radius:9px;font-size:14px;cursor:pointer;">Batal</button>'+
      '<button type="button" id="_yes" style="padding:10px 16px;border:0;background:#14213d;color:#fff;border-radius:9px;font-size:14px;cursor:pointer;">Ya, tambahkan</button></div>';
    ov.appendChild(box); document.body.appendChild(ov);
    const done=v=>{ if(ov.parentNode) document.body.removeChild(ov); res(v); };
    box.querySelector('#_yes').onclick=()=>done(true);
    box.querySelector('#_no').onclick=()=>done(false);
    ov.onclick=e=>{ if(e.target===ov) done(false); };
  });
}

function updateBadge(){ const n=outboxAll().length; const b=el('outboxBadge'); if(n>0){ b.textContent=n; b.classList.remove('hidden'); } else b.classList.add('hidden'); }
function done(item){ outboxRemove(item.id); updateBadge(); toast('✓ Tersimpan: '+item.data.partNumber,'success'); }

async function processItem(item){
  outboxUpdate(item.id,{status:'sending',sendingAt:Date.now()}); updateBadge();
  try{ await deliver(item); done(item); return; }
  catch(e1){
    outboxUpdate(item.id,{status:'sending',sendingAt:Date.now()}); updateBadge(); await sleep(800);
    try{ await deliver(item); done(item); }
    catch(e2){ outboxUpdate(item.id,{status:'failed',lastError:String(e2.message||e2)}); updateBadge(); toast('Gagal kirim: '+item.data.partNumber+'. Buka Monitor untuk Retry.','error'); }
  }
}

el('qcForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const tujuan=normUp(el('tujuan').value), posisi=normUp(el('posisi').value);
  const partNumber=el('partNumber').value.trim(), qty=el('qty').value.trim(), tanggal=el('tanggal').value;
  el('tujuan').value=tujuan; el('posisi').value=posisi; // tampilkan versi KAPITAL
  if(!tujuan||!partNumber||!qty){ toast('Tujuan, Part Number, Qty wajib diisi.','error'); return; }

  const hasTujuan = SMALL.tujuan.some(v=>String(v).toUpperCase()===tujuan);
  const hasPosisi = !posisi || SMALL.posisi.some(v=>String(v).toUpperCase()===posisi);

  if(!hasTujuan){
    const okAdd=await askConfirm('Tujuan "<b>'+esc(tujuan)+'</b>" belum ada di master.<br>Tambahkan ke master?');
    if(!okAdd){ toast('Dibatalkan. Perbaiki dulu Tujuan.','error'); el('tujuan').focus(); return; }
  }
  if(posisi && !hasPosisi){
    const okAdd=await askConfirm('Posisi "<b>'+esc(posisi)+'</b>" belum ada di master.<br>Tambahkan ke master?');
    if(!okAdd){ toast('Dibatalkan. Perbaiki dulu Posisi.','error'); el('posisi').focus(); return; }
  }

  const data={ tujuan, tanggal, partNumber, qty, posisi };
  const id=uuid(); const item={id,submitId:id,status:'pending',createdAt:Date.now(),data};
  outboxAdd(item); updateBadge();

  // optimistik: langsung muncul di saran tanpa menunggu sinkron
  let changed=false;
  if(!hasTujuan){ SMALL.tujuan=sortAZ(SMALL.tujuan.concat([tujuan])); changed=true; }
  if(posisi && !hasPosisi){ SMALL.posisi=sortAZ(SMALL.posisi.concat([posisi])); changed=true; }
  if(changed){ lastSmallJson=JSON.stringify(SMALL); cacheSetSmall(SMALL); applySmall(); }

  el('partNumber').value=''; el('qty').value=''; el('partNamePreview').textContent='—'; el('partNamePreview').className='hint'; el('partNumber').focus();
  processItem(item);
});

async function processOutbox(){ outboxResetSending(); for(const it of outboxAll()){ if(it.status!=='sending') await processItem(it); } }

document.addEventListener('DOMContentLoaded',()=>{
  el('tanggal').value=todayLocal(); updateBadge();
  const c=cacheGetSmall(); if(c){ SMALL={tujuan:sortAZ(c.tujuan),posisi:sortAZ(c.posisi)}; lastSmallJson=JSON.stringify(SMALL); applySmall(); }
  refreshSmall();
  syncBg();
  setInterval(()=>{ refreshSmall(); syncBg(); }, MASTER_REFRESH_MS);
  processOutbox();
});