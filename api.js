function jsonp(params, timeoutMs){
  return new Promise((resolve, reject)=>{
    const cb='cb_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
    const s=document.createElement('script'); let done=false;
    const timer=setTimeout(()=>{ if(!done){done=true;cleanup();reject(new Error('Timeout / koneksi gagal.'));} }, timeoutMs||15000);
    function cleanup(){ delete window[cb]; if(s.parentNode)s.parentNode.removeChild(s); clearTimeout(timer); }
    window[cb]=d=>{ if(done)return; done=true; cleanup(); resolve(d); };
    const q=Object.keys(params).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
    s.src=API_URL+'?'+q+'&callback='+cb;
    s.onerror=()=>{ if(done)return; done=true; cleanup(); reject(new Error('Gagal menghubungi server.')); };
    document.body.appendChild(s);
  });
}
function toast(msg,type){ const t=document.getElementById('toast'); if(!t)return; t.textContent=msg; t.className='toast show '+(type||''); clearTimeout(window.__tt); window.__tt=setTimeout(()=>{t.className='toast';},3500); }

function confirmModal(o){
  return new Promise(res=>{
    const ov=document.createElement('div'); ov.className='modal-overlay';
    ov.innerHTML='<div class="modal"><h3>'+(o.title||'Konfirmasi')+'</h3><p>'+(o.message||'')+'</p>'+
      '<div class="modal-actions"><button class="btn-ghost" data-a="cancel">'+(o.cancelText||'Batal')+'</button>'+
      '<button class="'+(o.danger?'btn-danger':'btn-primary')+'" data-a="ok">'+(o.okText||'Ya')+'</button></div></div>';
    document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('show'));
    ov.addEventListener('click',e=>{ const a=e.target.getAttribute&&e.target.getAttribute('data-a');
      if(e.target===ov||a==='cancel'||a==='ok'){ ov.classList.remove('show'); setTimeout(()=>ov.remove(),200); res(a==='ok'); } });
  });
}
function promptModal(o){
  return new Promise(res=>{
    const ov=document.createElement('div'); ov.className='modal-overlay';
    const f=o.fields.map(x=>'<label class="mlabel">'+x.label+'<input data-f="'+x.name+'" value="'+((x.value||'').replace(/"/g,'&quot;'))+'" placeholder="'+(x.placeholder||'')+'"></label>').join('');
    ov.innerHTML='<div class="modal"><h3>'+(o.title||'')+'</h3>'+f+
      '<div class="modal-actions"><button class="btn-ghost" data-a="cancel">Batal</button><button class="btn-primary" data-a="ok">'+(o.okText||'Simpan')+'</button></div></div>';
    document.body.appendChild(ov); requestAnimationFrame(()=>ov.classList.add('show'));
    const inputs=ov.querySelectorAll('input'); if(inputs[0]) setTimeout(()=>inputs[0].focus(),60);
    ov.addEventListener('click',e=>{ const a=e.target.getAttribute&&e.target.getAttribute('data-a');
      if(e.target===ov||a==='cancel'){ close(null); }
      else if(a==='ok'){ const out={}; inputs.forEach(i=>out[i.getAttribute('data-f')]=i.value.trim()); close(out); } });
    function close(v){ ov.classList.remove('show'); setTimeout(()=>ov.remove(),200); res(v); }
  });
}
