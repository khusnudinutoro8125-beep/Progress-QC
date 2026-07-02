const el=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
let cur='tujuan', partPage=0, partQuery='';

function switchTab(t){ cur=t;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==t));
  if(t==='part'){ partPage=0; loadParts(); } else loadSimple(t);
}

async function loadSimple(type){
  const box=el(type+'List'); box.innerHTML='<div class="muted">Memuat…</div>';
  const r=await jsonp({action:'getMasterList',type},15000);
  if(r.status!=='success'){ box.innerHTML='<div class="muted">Gagal memuat</div>'; return; }
  const items=r.data.items;
  box.innerHTML=items.length? items.map(v=>'<div class="mrow"><span class="mval">'+esc(v)+'</span><span class="mact"><button class="btn-icon" data-edit data-type="'+type+'" data-val="'+esc(v)+'">✏️</button><button class="btn-icon danger" data-del data-type="'+type+'" data-val="'+esc(v)+'">🗑️</button></span></div>').join('') : '<div class="muted">Belum ada data.</div>';
}

async function loadParts(){
  const box=el('partList'); box.innerHTML='<div class="muted">Memuat…</div>';
  const r=await jsonp({action:'searchParts',q:partQuery,page:partPage,size:30},20000);
  if(r.status!=='success'){ box.innerHTML='<div class="muted">Gagal memuat</div>'; return; }
  const {parts,total,size}=r.data;
  box.innerHTML=parts.length? parts.map(p=>'<div class="mrow"><span class="mval"><b>'+esc(p.pn)+'</b><br><small class="muted">'+esc(p.name)+'</small></span><span class="mact"><button class="btn-icon" data-editpart data-pn="'+esc(p.pn)+'" data-name="'+esc(p.name)+'">✏️</button><button class="btn-icon danger" data-delpart data-pn="'+esc(p.pn)+'">🗑️</button></span></div>').join('') : '<div class="muted">Tidak ada part.</div>';
  const pages=Math.ceil(total/size)||1;
  el('partPager').innerHTML='<button class="btn-small" '+(partPage<=0?'disabled':'')+' data-pg="prev">‹ Prev</button><span class="muted">Hal '+(partPage+1)+' / '+pages+' • '+total+' part</span><button class="btn-small" '+(partPage>=pages-1?'disabled':'')+' data-pg="next">Next ›</button>';
}

document.querySelector('.tabs').addEventListener('click',e=>{ const t=e.target.dataset.tab; if(t) switchTab(t); });

document.body.addEventListener('click', async e=>{
  const t=e.target;
  if(t.dataset.add==='tujuan'||t.dataset.add==='posisi'){
    const type=t.dataset.add;
    const v=await promptModal({title:'Tambah '+type,fields:[{name:'value',label:type==='tujuan'?'Tujuan':'Posisi'}]});
    if(v&&v.value){ const r=await jsonp({action:'masterAdd',type,value:v.value},15000); r.status==='success'?(toast('Ditambahkan ✔','success'),loadSimple(type)):toast(r.message,'error'); }
  }
  else if(t.dataset.add==='part'){
    const v=await promptModal({title:'Tambah Part',fields:[{name:'value',label:'Part Number'},{name:'name',label:'Part Name'}]});
    if(v&&v.value){ const r=await jsonp({action:'masterAdd',type:'part',value:v.value,name:v.name},15000); r.status==='success'?(toast('Ditambahkan ✔','success'),loadParts()):toast(r.message,'error'); }
  }
  else if(t.hasAttribute('data-edit')){
    const type=t.dataset.type, old=t.dataset.val;
    const v=await promptModal({title:'Edit',fields:[{name:'value',label:'Nilai',value:old}]});
    if(v&&v.value){ const r=await jsonp({action:'masterEdit',type,oldValue:old,value:v.value},15000); r.status==='success'?(toast('Disimpan ✔','success'),loadSimple(type)):toast(r.message,'error'); }
  }
  else if(t.hasAttribute('data-del')){
    const type=t.dataset.type, val=t.dataset.val;
    const yes=await confirmModal({title:'Hapus data?',message:'Yakin hapus "<b>'+esc(val)+'</b>"? Data QC lama yang sudah memakai ini tidak akan berubah.',okText:'Hapus',danger:true});
    if(yes){ const r=await jsonp({action:'masterDelete',type,value:val},15000); r.status==='success'?(toast('Dihapus ✔','success'),loadSimple(type)):toast(r.message,'error'); }
  }
  else if(t.hasAttribute('data-editpart')){
    const pn=t.dataset.pn, name=t.dataset.name;
    const v=await promptModal({title:'Edit Part',fields:[{name:'value',label:'Part Number',value:pn},{name:'name',label:'Part Name',value:name}]});
    if(v){ const r=await jsonp({action:'masterEdit',type:'part',oldValue:pn,value:v.value,name:v.name},15000); r.status==='success'?(toast('Disimpan ✔','success'),loadParts()):toast(r.message,'error'); }
  }
  else if(t.hasAttribute('data-delpart')){
    const pn=t.dataset.pn;
    const yes=await confirmModal({title:'Hapus part?',message:'Yakin hapus part <b>'+esc(pn)+'</b>? Data QC lama tetap menyimpan nama saat input.',okText:'Hapus',danger:true});
    if(yes){ const r=await jsonp({action:'masterDelete',type:'part',value:pn},15000); r.status==='success'?(toast('Dihapus ✔','success'),loadParts()):toast(r.message,'error'); }
  }
  else if(t.dataset.pg==='prev'){ if(partPage>0){ partPage--; loadParts(); } }
  else if(t.dataset.pg==='next'){ partPage++; loadParts(); }
});

let sTimer; el('partSearch').addEventListener('input',()=>{ clearTimeout(sTimer); sTimer=setTimeout(()=>{ partQuery=el('partSearch').value.trim(); partPage=0; loadParts(); },300); });

document.addEventListener('DOMContentLoaded',()=>loadSimple('tujuan'));
