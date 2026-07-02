const el=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function label(s){ return {pending:'Menunggu',sending:'Mengirim…',failed:'Gagal — ketuk Retry'}[s]||s; }

function render(){
  const items=outboxAll();
  el('summary').textContent = items.length? items.length+' data di antrean' : 'Semua terkirim — tidak ada yang tertahan ✔';
  el('list').innerHTML = items.length ? items.map(it=>'<div class="mrow"><div><b>'+esc(it.data.partNumber)+'</b> · Qty '+esc(it.data.qty)+'<br><small class="muted">'+esc(it.data.tujuan)+' · '+esc(it.data.tanggal)+'</small></div><div class="obx-right"><span class="badge-status '+it.status+'">'+label(it.status)+'</span><button class="btn-small" data-retry="'+it.id+'" '+(it.status==='sending'?'disabled':'')+'>Retry</button></div></div>').join('') : '<div class="empty">Tidak ada data tertunda.</div>';
}

async function processItem(item){
  outboxUpdate(item.id,{status:'sending',sendingAt:Date.now()}); render();
  try{ await deliver(item); outboxRemove(item.id); render(); toast('✓ Terkirim: '+item.data.partNumber,'success'); return; }
  catch(e1){
    outboxUpdate(item.id,{status:'sending',sendingAt:Date.now()}); render(); await sleep(800);
    try{ await deliver(item); outboxRemove(item.id); render(); toast('✓ Terkirim: '+item.data.partNumber,'success'); }
    catch(e2){ outboxUpdate(item.id,{status:'failed',lastError:String(e2.message||e2)}); render(); }
  }
}
async function userRetry(id){
  const it=outboxAll().find(x=>x.id===id); if(!it) return;
  outboxUpdate(id,{status:'sending',sendingAt:Date.now()}); render();
  try{ await deliver(it); outboxRemove(id); render(); toast('✓ Terkirim: '+it.data.partNumber,'success'); }
  catch(e){ outboxUpdate(id,{status:'failed',lastError:String(e.message||e)}); render(); toast('Masih gagal. Coba lagi nanti.','error'); }
}

el('list').addEventListener('click',e=>{ const id=e.target.getAttribute('data-retry'); if(id) userRetry(id); });
el('retryAll').addEventListener('click', async()=>{ for(const it of outboxAll()){ if(it.status!=='sending') await userRetry(it.id); } });

document.addEventListener('DOMContentLoaded',()=>{
  outboxResetSending(); render();
  (async()=>{ for(const it of outboxAll()){ if(it.status!=='sending') await processItem(it); } })();
  setInterval(render,2000);
});