async function fetchWeather() {
  const apiKey = "670547e6da46825d0310f0b0cf3af21c"; // TODO: 替换成你的OpenWeather API Key
  const url = `https://api.openweathermap.org/data/2.5/weather?q=Singapore&units=metric&appid=${apiKey}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    document.getElementById("weather").innerText = `${data.weather[0].description}, ${data.main.temp}°C`;
  } catch (err) {
    console.error(err);
  }
}
fetchWeather();

// 多图发帖 & 互动逻辑
document.addEventListener('DOMContentLoaded', ()=>{
  const contentBox = document.querySelector('textarea[name="content"], #weibo-content');
  const homeForm = document.querySelector('form.post-form');
  // 如果是 home.ejs 左侧发帖（需要改模板加入多图 input name="files" multiple）
  const fileInput = document.querySelector('input[type="file"][name="files"], #weibo-file');
  // 动态预览容器（稍后模板要提供一个 id="weibo-previews" 或 .previews 容器）
  const previews = document.getElementById('weibo-previews') || document.querySelector('.image-previews');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (!previews) return;
      previews.innerHTML='';
      Array.from(fileInput.files).slice(0,4).forEach(f=>{
        const url = URL.createObjectURL(f);
        const img = document.createElement('img');
        img.src = url; img.style.width='70px'; img.style.height='70px'; img.style.objectFit='cover'; img.style.borderRadius='6px';
        previews.appendChild(img);
      });
    });
  }

  // 点赞 / 分享 / 评论交互 (home 模板更新后会有对应按钮 class)
  function bindInteractions(){
    document.querySelectorAll('.btn-like').forEach(btn=>{
      if (btn._bound) return; btn._bound=true;
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-post-id');
        try {
          const res = await fetch('/api/posts/'+encodeURIComponent(id)+'/like', { method:'POST' });
          const j = await res.json();
          btn.querySelector('.like-count').textContent = j.likes || 0;
        } catch(e){ console.error(e); alert('Like failed'); }
      });
    });
    document.querySelectorAll('.btn-share').forEach(btn=>{
      if (btn._bound) return; btn._bound=true;
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-post-id');
        try {
          const res = await fetch('/api/posts/'+encodeURIComponent(id)+'/share', { method:'POST' });
          const j = await res.json();
          btn.querySelector('.share-count').textContent = j.shares || 0;
          if (res.ok) location.reload();
        } catch(e){ console.error(e); alert('Share failed'); }
      });
    });
    document.querySelectorAll('.btn-comment-toggle').forEach(btn=>{
      if (btn._bound) return; btn._bound=true;
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-post-id');
        const sec = document.querySelector('.comments-section[data-post-id="'+id+'"]');
        if (sec) sec.style.display = sec.style.display === 'none' ? '' : 'none';
      });
    });
    document.querySelectorAll('.btn-comment-submit').forEach(btn=>{
      if (btn._bound) return; btn._bound=true;
      btn.addEventListener('click', async ()=>{
        const container = btn.closest('.comments-section');
        const id = container.getAttribute('data-post-id');
        const input = container.querySelector('.comment-input');
        const text = input.value.trim(); if (!text) return;
        try {
          const res = await fetch('/api/posts/'+encodeURIComponent(id)+'/comment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: text }) });
          const j = await res.json();
          if (res.ok){
            const div = document.createElement('div'); div.className='comment'; div.innerHTML = `<strong>${j.comment.username}</strong>: ${j.comment.content}`;
            container.querySelector('.existing-comments').appendChild(div);
            input.value='';
            const toggleBtn = document.querySelector('.btn-comment-toggle[data-post-id="'+id+'"]');
            if (toggleBtn) toggleBtn.querySelector('.comment-count').textContent = j.comments || 0;
          } else alert(j.error||'Comment failed');
        } catch(e){ console.error(e); alert('Comment failed'); }
      });
    });
  }
  bindInteractions();

  // ===== Drafts Logic =====
  const draftListEl = document.getElementById('draft-list');
  const saveDraftBtn = document.getElementById('draft-save-btn');
  const draftIdInput = document.getElementById('current-draft-id');
  function renderDrafts(drafts){
    if (!draftListEl) return;
    draftListEl.innerHTML = '';
    drafts.forEach(d => {
      const row = document.createElement('div');
      row.style.display='flex'; row.style.alignItems='center'; row.style.gap='6px';
      row.innerHTML = `<span style="flex:1;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${(d.content||'').replace(/"/g,'&quot;')}">${(d.content||'').slice(0,22)||'(空)'}${(d.content||'').length>22?'...':''}</span>`+
        `<button data-act="edit" data-id="${d.id}" style="padding:2px 6px;">编辑</button>`+
        `<button data-act="publish" data-id="${d.id}" style="padding:2px 6px;">发布</button>`+
        `<button data-act="del" data-id="${d.id}" style="padding:2px 6px;color:#a00;">删</button>`;
      draftListEl.appendChild(row);
    });
  }
  async function loadDrafts(){
    try { const res = await fetch('/api/drafts'); if (!res.ok) return; const j = await res.json(); renderDrafts(j.drafts||[]); } catch(e){ console.warn('load drafts failed', e); }
  }
  async function saveDraft(){
    if (!contentBox) return;
    const content = contentBox.value;
    const form = new FormData();
    form.append('content', content);
    const existingId = draftIdInput && draftIdInput.value ? draftIdInput.value : '';
    if (existingId) form.append('draft_id', existingId);
    // 保留的已上传文件（当前简单：不支持编辑时保留旧文件，扩展时可加入 kept_files）
    const fileInput2 = document.getElementById('files');
    if (fileInput2){ Array.from(fileInput2.files).forEach(f => form.append('files', f)); }
    try {
      const res = await fetch('/api/drafts', { method:'POST', body: form });
      const j = await res.json();
      if (res.ok){ draftIdInput.value = j.id; loadDrafts(); alert('草稿已保存'); }
      else alert(j.error || '保存失败');
    } catch(e){ alert('保存失败: '+e.message); }
  }
  async function deleteDraft(id){
    if (!confirm('确定删除该草稿?')) return;
    try { const res = await fetch('/api/drafts/'+id, { method:'DELETE' }); if (res.ok){ loadDrafts(); if (draftIdInput.value == id) draftIdInput.value=''; } } catch(e){ alert('删除失败'); }
  }
  async function publishDraft(id){
    try { const res = await fetch('/api/drafts/'+id+'/publish', { method:'POST' }); const j = await res.json(); if (res.ok){ alert('发布成功'); draftIdInput.value=''; loadDrafts(); location.reload(); } else alert(j.error||'发布失败'); } catch(e){ alert('发布失败'); }
  }
  function editDraft(id){
    // 简化：重新获取全部草稿并找到该条
    fetch('/api/drafts').then(r=>r.json()).then(j=>{
      const d = (j.drafts||[]).find(x=>x.id==id); if(!d) return;
      draftIdInput.value = d.id;
      if (contentBox) contentBox.value = d.content||'';
      if (previews){ previews.innerHTML=''; (d.files||[]).forEach(f=>{ const img=document.createElement('img'); img.src=f; img.style.width='70px'; img.style.height='70px'; img.style.objectFit='cover'; img.style.borderRadius='6px'; previews.appendChild(img); }); }
      alert('已载入草稿，可继续编辑后再次保存或发布');
    });
  }
  if (saveDraftBtn) saveDraftBtn.addEventListener('click', saveDraft);
  if (draftListEl){
    draftListEl.addEventListener('click', e => {
      const btn = e.target.closest('button'); if (!btn) return;
      const id = btn.getAttribute('data-id'); const act = btn.getAttribute('data-act');
      if (act==='del') deleteDraft(id);
      else if (act==='publish') publishDraft(id);
      else if (act==='edit') editDraft(id);
    });
    loadDrafts();
  }
});
