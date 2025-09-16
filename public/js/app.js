
async function fetchJSON(url, opts={}){
  const r = await fetch(url, Object.assign({ headers: { 'Content-Type':'application/json' }}, opts));
  if(!r.ok){ throw new Error((await r.json()).error || ('HTTP '+r.status)); }
  return r.json();
}
async function getWeather(){
  try{
    const data = await fetchJSON('/api/weather');
    const t = Math.round(data.main.temp);
    const desc = data.weather?.[0]?.description || '';
    document.querySelector('#weather').textContent = `${t}°C • ${desc}`;
  }catch(e){
    document.querySelector('#weather').textContent = 'Weather unavailable';
  }
}
async function loadTopics(){
  const { topics } = await fetchJSON('/api/topics');
  const grid = document.querySelector('#topic-grid');
  if(!grid) return;
  grid.innerHTML = '';
  topics.forEach(t=>{
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="pill">Topic</div><h3 style="margin:.4rem 0">${t}</h3><div class="helper">Tap to explore posts</div>`;
    div.onclick = ()=> location.href = '/topic/'+encodeURIComponent(t);
    grid.appendChild(div);
  });
}
async function searchTopics(){
  const q = (document.querySelector('#search')?.value||'').toLowerCase();
  document.querySelectorAll('#topic-grid .card').forEach(c=>{
    const hit = c.querySelector('h3').textContent.toLowerCase().includes(q);
    c.style.display = hit ? '' : 'none';
  });
}
async function loadPosts(topic){
  const { posts } = await fetchJSON('/api/posts?topic='+encodeURIComponent(topic));
  const box = document.querySelector('#feed');
  box.innerHTML = '';
  posts.forEach(p=>{
    const el = document.createElement('article');
    el.className = 'post-card';
    el.innerHTML = `
      <div class="post-head">
        <img src="${p.user.avatar}" alt="avatar" />
        <div><strong>${p.user.name}</strong><div class="helper">${new Date(p.createdAt).toLocaleString()}</div></div>
      </div>
      <div>${escapeHtml(p.content).replace(/\n/g,'<br>')}</div>
      ${p.files?.length ? '<div style="margin-top:8px; display:grid; gap:6px">'+p.files.map(f=>`<img src="${f}" alt="upload" style="max-width:100%; border-radius:12px">`).join('')+'</div>' : ''}
      <div class="post-actions"><span>♡ ${p.likes}</span><span>💬 ${p.comments}</span><span>↗ ${p.shares}</span></div>`;
    box.appendChild(el);
  });
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// Quick post button
function wireQuickPost(topic){
  const btn = document.querySelector('#quick-post');
  if(!btn) return;
  btn.onclick = ()=>{
    const target = topic ? '/topic/'+encodeURIComponent(topic) : '/';
    if(location.pathname !== target){ location.href = target; return; }
    document.querySelector('#content')?.focus();
    document.querySelector('#post-box')?.scrollIntoView({behavior:'smooth'});
  };
}

// Auth pages
async function handleLoginSubmit(e){
  e.preventDefault();
  const username = e.target.username.value.trim();
  const password = e.target.password.value;
  try{
    await fetchJSON('/api/login', { method:'POST', body: JSON.stringify({ username, password }) });
    location.href = '/';
  }catch(err){
    alert(err.message + '\nYou may need to register first. Redirecting...');
    location.href = '/register';
  }
}
async function handleRegisterSubmit(e){
  e.preventDefault();
  const username = e.target.username.value.trim();
  const password = e.target.password.value;
  if(!username || !password) return alert('Please fill all fields');
  await fetchJSON('/api/register', { method:'POST', body: JSON.stringify({ username, password }) });
  location.href = '/';
}
async function loginWithMetamask(){
  if(!window.ethereum){ alert('Please install MetaMask'); return; }
  const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
  const { nonce } = await fetchJSON('/api/metamask/nonce?address='+address);
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [nonce, address]
  });
  await fetchJSON('/api/metamask/verify', { method:'POST', body: JSON.stringify({ address, signature, nonce }) });
  location.href = '/';
}

// Post form
async function submitPost(e, topic){
  e.preventDefault();
  const fd = new FormData(e.target);
  fd.append('topic', topic);
  const r = await fetch('/api/posts', { method:'POST', body: fd });
  if(!r.ok){
    const j = await r.json();
    alert(j.error || 'Failed to post');
    if(j.error && j.error.includes('Login')) location.href = '/login';
    return;
  }
  e.target.reset();
  await loadPosts(topic);
}
