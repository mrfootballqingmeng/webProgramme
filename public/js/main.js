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
    // 用于存储当前选择的文件列表
    let selectedFiles = [];
    fileInput.addEventListener('change', () => {
      if (!previews) return;
      selectedFiles = Array.from(fileInput.files).slice(0,4);
      renderPreviews();
    });

    function renderPreviews() {
      previews.innerHTML = '';
      selectedFiles.forEach((f, idx) => {
        const url = URL.createObjectURL(f);
        const wrapper = document.createElement('div');
        wrapper.style.display = 'inline-block';
        wrapper.style.position = 'relative';
        wrapper.style.marginRight = '6px';
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '70px';
        img.style.height = '70px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.title = '移除';
        delBtn.style.position = 'absolute';
        delBtn.style.top = '0';
        delBtn.style.right = '0';
        delBtn.style.background = 'rgba(0,0,0,0.6)';
        delBtn.style.color = '#fff';
        delBtn.style.border = 'none';
        delBtn.style.borderRadius = '50%';
        delBtn.style.width = '20px';
        delBtn.style.height = '20px';
        delBtn.style.cursor = 'pointer';
        delBtn.onclick = (e) => {
          e.preventDefault();
          selectedFiles.splice(idx, 1);
          updateFileInput();
          renderPreviews();
        };
        wrapper.appendChild(img);
        wrapper.appendChild(delBtn);
        previews.appendChild(wrapper);
      });
    }
    // 用于同步 fileInput.files
    function updateFileInput() {
      const dt = new DataTransfer();
      selectedFiles.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
    }
  }

  // ===== Calendar (右侧) =====
  const calList = document.getElementById('cal-list') || document.getElementById('upcoming-body');
  const btnAdd = document.getElementById('cal-add');
  async function loadEvents(){
    if (!calList) return;
    try{
      const r = await fetch('/api/events');
      if (!r.ok) { calList.innerHTML = '<div style="color:#999;">请先登录以查看日程</div>'; return; }
      const j = await r.json();
      const items = (j.events||[]).map(ev => {
        const when = new Date(ev.start_time).toLocaleString();
        const title = ev.title || '(无标题)';
        const loc = ev.location ? ` @ ${ev.location}` : '';
        return `<div class="cal-item" data-id="${ev.id}" style="display:flex;gap:8px;align-items:center;border:1px solid #eee;border-radius:8px;padding:8px;">
          <div style="flex:1;">
            <div style="font-weight:600;">${title}${loc}</div>
            <div style="color:#6b7280;font-size:12px;">${when}</div>
          </div>
          <button class="btn-del-event" data-id="${ev.id}" style="background:#fff;border:1px solid #e5e7eb;color:#dc3545;border-radius:8px;padding:4px 8px;">删除</button>
        </div>`;
      }).join('');
      calList.innerHTML = items || '<div style="color:#999;">No events in the next 30 days</div>';
    }catch(e){ calList.innerHTML = '<div style="color:#999;">Failed to load</div>'; }
  }
  if (calList) loadEvents();
  if (calList){
    calList.addEventListener('click', async (e)=>{
      const btn = e.target.closest('.btn-del-event');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      if (!confirm('确定删除该事件？')) return;
      try{ const r = await fetch('/api/events/'+id, { method:'DELETE' }); if (r.ok) loadEvents(); } catch(_){ }
    });
  }
  if (btnAdd){
    btnAdd.addEventListener('click', async ()=>{
      const title = document.getElementById('cal-title').value.trim();
      const start = document.getElementById('cal-start').value;
      const end = document.getElementById('cal-end').value;
      const location = document.getElementById('cal-location').value.trim();
      const notes = document.getElementById('cal-notes').value.trim();
      const remind = document.getElementById('cal-remind').value;
      if (!title || !start){ alert('Please fill in title and start time'); return; }
      
      // Convert custom format to ISO format for API
      const startISO = start ? start.replace(' ', 'T') + ':00' : null;
      const endISO = end ? end.replace(' ', 'T') + ':00' : null;
      
      try{
        const r = await fetch('/api/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, start_time:startISO, end_time:endISO||null, location, notes, remind_minutes: remind }) });
        const j = await r.json();
        if (r.ok){
          // 清空表单并刷新
          ['cal-title','cal-start','cal-end','cal-location','cal-notes'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
          loadEvents();
        } else { alert(j.error||'Failed to add'); }
      }catch(e){ alert('Failed to add'); }
    });
  }

  // 打开中间草稿箱卡片
  const openDraftsBtn = document.getElementById('open-drafts');
  if (openDraftsBtn){
    openDraftsBtn.addEventListener('click', ()=>{
      showDraftsView();
    });
  }

  // 返回帖子视图
  const backToPostsBtn = document.getElementById('back-to-posts');
  if (backToPostsBtn){
    backToPostsBtn.addEventListener('click', ()=>{
      showPostsView();
    });
  }

  // ===== Collapsible: Calendar & Upcoming =====
  function setupCollapse(toggleId, bodyId, storageKey, expandedDisplay){
    const btn = document.getElementById(toggleId);
    const body = document.getElementById(bodyId);
    if (!btn || !body) return;
    const icon = btn.querySelector('i');
    const saved = localStorage.getItem(storageKey);
    if (saved === 'collapsed'){
      body.style.display = 'none';
      btn.setAttribute('aria-expanded','false');
      if (icon) icon.className = 'fa fa-chevron-down';
    } else if (expandedDisplay) {
      body.style.display = expandedDisplay;
    }
    btn.addEventListener('click', ()=>{
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? (expandedDisplay || '') : 'none';
      btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      if (icon) icon.className = isHidden ? 'fa fa-chevron-up' : 'fa fa-chevron-down';
      localStorage.setItem(storageKey, isHidden ? 'expanded' : 'collapsed');
    });
  }
  setupCollapse('toggle-calendar', 'calendar-body', 'card.calendar', 'flex');
  setupCollapse('toggle-upcoming', 'upcoming-body', 'card.upcoming', 'flex');
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
    document.querySelectorAll('.btn-delete').forEach(btn=>{
      if (btn._bound) return; btn._bound=true;
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-post-id');
        if (!confirm('确定要删除这个帖子吗？删除后无法恢复。')) return;
        try {
          const res = await fetch('/api/posts/'+encodeURIComponent(id), { method:'DELETE' });
          const j = await res.json();
          if (res.ok){
            // Remove the post card from the DOM
            const postCard = btn.closest('.post-card');
            if (postCard) {
              postCard.style.transition = 'opacity 0.3s ease';
              postCard.style.opacity = '0';
              setTimeout(() => postCard.remove(), 300);
            }
            alert('Post deleted');
          } else {
            alert(j.error || 'Delete failed');
          }
        } catch(e){ console.error(e); alert('Delete failed'); }
      });
    });
  }
  bindInteractions();

  // ===== 用户卡片交互（中文注释） =====
  const userCard = document.getElementById('user-card');
  const elAvatar = document.getElementById('uc-avatar');
  const elDisplay = document.getElementById('uc-display');
  const elUsername = document.getElementById('uc-username');
  const elBio = document.getElementById('uc-bio');
  const elFollowers = document.getElementById('uc-followers');
  const elFollowing = document.getElementById('uc-following');
  const elFollowBtn = document.getElementById('uc-follow-btn');

  let currentHoverUserId = null;
  let isFollowing = false;
  let isSelf = false;

  // 中文注释：将卡片定位为“固定在被点击用户名附近”，不再跟随鼠标
  function positionCardAtAnchor(anchorEl){
    if (!userCard || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const pageX = rect.left + window.scrollX;
    const pageYBottom = rect.bottom + window.scrollY;
    const margin = 8; // 与锚点的间距
    const cardWidth = 280; // 与 CSS 中宽度一致

    // 先显示以便读取高度
    userCard.style.display = 'block';
    const cardHeight = userCard.offsetHeight || 180;

    // 默认放在元素下方，若空间不足则放在上方
    let top = pageYBottom + margin;
    if (top + cardHeight > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - cardHeight - margin;
    }

    let left = pageX;
    if (left + cardWidth > window.innerWidth + window.scrollX) {
      left = Math.max(8, window.innerWidth + window.scrollX - cardWidth - 8);
    }

    userCard.style.left = left + 'px';
    userCard.style.top = top + 'px';
  }

  async function loadUserSummary(userId){
    try{
      const res = await fetch('/api/users/'+userId+'/summary');
      if (!res.ok) throw new Error('load summary failed');
      const j = await res.json();
      const p = j.profile || {};
      elAvatar.src = p.avatar || '/images/logo.jpg';
      elDisplay.textContent = p.display_name || p.username || '用户';
      elUsername.textContent = '@' + (p.username || 'unknown');
      elBio.textContent = p.bio || '这个人很神秘，什么也没留下';
      elFollowers.textContent = j.followers || 0;
      elFollowing.textContent = j.following || 0;
      isFollowing = !!j.isFollowing;
      isSelf = !!j.isSelf;
      updateFollowBtn();
    }catch(e){ console.warn(e); }
  }

  function updateFollowBtn(){
    if (!elFollowBtn) return;
    if (isSelf){
      elFollowBtn.style.display = 'none';
      return;
    }
    elFollowBtn.style.display = '';
    if (isFollowing){
      elFollowBtn.textContent = '已关注';
      elFollowBtn.classList.remove('btn-follow');
      elFollowBtn.classList.add('btn-unfollow');
    } else {
      elFollowBtn.textContent = '关注';
      elFollowBtn.classList.add('btn-follow');
      elFollowBtn.classList.remove('btn-unfollow');
    }
  }

  // 事件委托：点击用户名打开卡片
  document.body.addEventListener('click', async (e)=>{
    const a = e.target.closest('.user-link');
    if (!a) return;
    const uid = a.getAttribute('data-user-id');
    currentHoverUserId = uid;
    await loadUserSummary(uid);
    // 中文注释：固定在被点击用户名附近
    positionCardAtAnchor(a);
  });

  // 点击空白处关闭
  document.addEventListener('click', (e)=>{
    if (!userCard) return;
    const onUser = e.target.closest('.user-link');
    const onCard = e.target.closest('#user-card');
    if (!onUser && !onCard){ userCard.style.display = 'none'; }
  });

  // 移除鼠标跟随逻辑：卡片位置固定，不随鼠标移动

  // 关注/取关按钮
  if (elFollowBtn){
    elFollowBtn.addEventListener('click', async ()=>{
      if (!currentHoverUserId) return;
      try{
        if (isFollowing){
          const res = await fetch('/api/users/'+currentHoverUserId+'/follow', { method:'DELETE' });
          if (!res.ok) throw new Error('unfollow failed');
          isFollowing = false;
          // 粉丝数-1（不小于0）
          const n = Math.max(0, (parseInt(elFollowers.textContent||'0',10) - 1));
          elFollowers.textContent = n;
        } else {
          const res = await fetch('/api/users/'+currentHoverUserId+'/follow', { method:'POST' });
          if (!res.ok) throw new Error('follow failed');
          isFollowing = true;
          elFollowers.textContent = (parseInt(elFollowers.textContent||'0',10) + 1);
        }
        updateFollowBtn();
      }catch(e){
        alert('Operation failed, please login first or try again later');
        console.warn(e);
      }
    });
  }

  // ===== Drafts Logic =====
  const draftListEl = document.getElementById('drafts-cards');
  const saveDraftBtn = document.getElementById('draft-save-btn');
  const draftIdInput = document.getElementById('current-draft-id');
  function renderDrafts(drafts){
    if (!draftListEl) return;
    draftListEl.innerHTML = '';
    if (!drafts || drafts.length === 0){
      draftListEl.innerHTML = '<div style="color:#999;padding:8px;border:1px dashed #ddd;border-radius:8px;">暂无草稿</div>';
      return;
    }
    drafts.forEach(d => {
      const card = document.createElement('div');
      card.className = 'post-card';
      card.setAttribute('data-id', d.id);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'post-content';
      const p = document.createElement('p');
      p.textContent = d.content || '';
      contentDiv.appendChild(p);

      if (Array.isArray(d.files) && d.files.length){
        const imgs = document.createElement('div');
        imgs.className = 'post-images';
        imgs.style.display = 'flex';
        imgs.style.gap = '6px';
        imgs.style.flexWrap = 'wrap';
        d.files.forEach(f => {
          const img = document.createElement('img');
          img.src = f;
          img.style.maxWidth = '180px';
          img.style.maxHeight = '180px';
          img.style.objectFit = 'cover';
          img.style.borderRadius = '6px';
          img.onerror = function(){ this.onerror=null; this.src='/images/logo.jpg'; };
          imgs.appendChild(img);
        });
        contentDiv.appendChild(imgs);
      }

      const actions = document.createElement('div');
      actions.className = 'post-actions';
      actions.style.marginTop = '8px';
      actions.style.display = 'flex';
      actions.style.gap = '10px';
      actions.style.alignItems = 'center';

      const btnEdit = document.createElement('button');
      btnEdit.textContent = '编辑';
      btnEdit.setAttribute('data-act','edit');
      btnEdit.setAttribute('data-id', d.id);

      const btnPublish = document.createElement('button');
      btnPublish.textContent = '发布';
      btnPublish.setAttribute('data-act','publish');
      btnPublish.setAttribute('data-id', d.id);

      const btnDel = document.createElement('button');
      btnDel.textContent = '删除';
      btnDel.style.color = '#a00';
      btnDel.setAttribute('data-act','del');
      btnDel.setAttribute('data-id', d.id);

      actions.appendChild(btnEdit);
      actions.appendChild(btnPublish);
      actions.appendChild(btnDel);

      card.appendChild(contentDiv);
      card.appendChild(actions);
      draftListEl.appendChild(card);
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
      if (res.ok){ draftIdInput.value = j.id; loadDrafts(); alert('Draft saved'); }
      else alert(j.error || 'Save failed');
    } catch(e){ alert('Save failed: '+e.message); }
  }
  async function deleteDraft(id){
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try { const res = await fetch('/api/drafts/'+id, { method:'DELETE' }); if (res.ok){ loadDrafts(); if (draftIdInput.value == id) draftIdInput.value=''; } } catch(e){ alert('Delete failed'); }
  }
  async function publishDraft(id){
    try { const res = await fetch('/api/drafts/'+id+'/publish', { method:'POST' }); const j = await res.json(); if (res.ok){ alert('Published successfully'); draftIdInput.value=''; loadDrafts(); location.reload(); } else alert(j.error||'Publish failed'); } catch(e){ alert('Publish failed'); }
  }
  function editDraft(id){
    // 简化：重新获取全部草稿并找到该条
    fetch('/api/drafts').then(r=>r.json()).then(j=>{
      const d = (j.drafts||[]).find(x=>x.id==id); if(!d) return;
      draftIdInput.value = d.id;
      if (contentBox) contentBox.value = d.content||'';
      if (previews){ previews.innerHTML=''; (d.files||[]).forEach(f=>{ const img=document.createElement('img'); img.src=f; img.style.width='70px'; img.style.height='70px'; img.style.objectFit='cover'; img.style.borderRadius='6px'; previews.appendChild(img); }); }
      alert('Draft loaded, you can continue editing and save or publish again');
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
    // 初始不加载，进入草稿视图时加载
  }

  function findPostsHeaderRow(){
    const titleEl = document.querySelector('.section-title');
    return titleEl ? titleEl.parentElement : null;
  }
  function showDraftsView(){
    const mainCard = document.getElementById('drafts-main-card');
    const postsFeed = document.getElementById('posts-feed');
    const headerRow = findPostsHeaderRow();
    if (mainCard) mainCard.style.display = '';
    if (postsFeed) postsFeed.style.display = 'none';
    if (headerRow) headerRow.style.display = 'none';
    loadDrafts();
  }
  function showPostsView(){
    const mainCard = document.getElementById('drafts-main-card');
    const postsFeed = document.getElementById('posts-feed');
    const headerRow = findPostsHeaderRow();
    if (mainCard) mainCard.style.display = 'none';
    if (postsFeed) postsFeed.style.display = '';
    if (headerRow) headerRow.style.display = 'flex';
  }
});

// ===== 固定右下角：法律链接（中文注释） =====
(function(){
  try{
    const box = document.createElement('div');
    box.className = 'legal-links';
    box.innerHTML = '<div class="legal-title" id="developer-toggle" style="cursor:pointer;user-select:none;" title="Click to expand">Developer <span id="developer-arrow">▼</span></div>'+
      '<div class="legal-contact" id="developer-details" style="display:none;margin-top:8px;font-size:12px;color:#666;line-height:1.6;">'+
      '<div style="margin-bottom:3px;">GAO HAO (G2503948L)</div>'+
      '<div style="margin-bottom:3px;">MA YUANYE (G2503333E)</div>'+
      '<div style="margin-bottom:3px;">DING JUNWEI (G2502024F)</div>'+
      '<div style="margin-bottom:3px;">HONG RUIHAN (G2503960J)</div>'+
      '<div style="margin-bottom:3px;">Qu ZhanRui (G2506628G)</div>'+
      '<div style="margin-bottom:3px;">DING ZIJIAN (G2502028E)</div>'+
      '<div>LIU JUNZHE (G2501961L)</div>'+
      '</div>'+
      '<div class="legal-sep"></div>'+
      '<a href="/terms" target="_self">Terms of Service</a> · <a href="/privacy" target="_self">Privacy Policy</a> · <a href="/cookies" target="_self">Cookie Policy</a>';
    document.addEventListener('DOMContentLoaded', ()=>{
      document.body.appendChild(box);
      
      // 添加点击展开/收起功能
      const toggle = document.getElementById('developer-toggle');
      const details = document.getElementById('developer-details');
      const arrow = document.getElementById('developer-arrow');
      
      toggle.addEventListener('click', function() {
        if (details.style.display === 'none') {
          details.style.display = 'block';
          arrow.textContent = '▲';
        } else {
          details.style.display = 'none';
          arrow.textContent = '▼';
        }
      });
    });
  }catch(e){}
})();
