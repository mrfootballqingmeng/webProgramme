// MetaMask frontend login logic
async function fetchJSON(url, opts){
  const res = await fetch(url, Object.assign({ headers: { 'Content-Type':'application/json' } }, opts||{}));
  if (!res.ok) throw new Error((await res.text())||('HTTP '+res.status));
  try { return await res.json(); } catch(e){ return {}; }
}

async function loginWithMetamask(){
  if(!window.ethereum){ alert('Please install MetaMask first'); return; }
  if (window.__metamask_lock) return;
  window.__metamask_lock = true;
  try {
    const provider = window.ethereum;
    // Try eth_accounts first
    let accounts = [];
    try { accounts = await provider.request({ method:'eth_accounts' }); } catch(e){ accounts=[]; }
    const maxRetries = 6; let attempt = 0;
    if (!accounts || accounts.length===0){
      while (attempt < maxRetries){
        try {
          accounts = await provider.request({ method:'eth_requestAccounts' });
          break;
        } catch(err){
          const msg = (err&&err.message)||''; const code = err&&err.code;
            if (code === -32002 || msg.includes('Already processing')) {
              const waitMs = 500*Math.pow(2, attempt);
              await new Promise(r=>setTimeout(r, waitMs));
              attempt++; continue;
            }
            throw err;
        }
      }
    }
    if (!accounts || accounts.length===0) throw new Error('User rejected or wallet busy');
    const address = accounts[0];
    const { nonce } = await fetchJSON('/api/metamask-nonce?address='+address);
    const signature = await provider.request({ method:'personal_sign', params:[nonce, address] });
    await fetchJSON('/api/metamask-login', { method:'POST', body: JSON.stringify({ address, signature }) });
    location.href = '/home';
  } catch(e){
    console.error('MetaMask login failed', e); alert('MetaMask login failed: '+(e && e.message ? e.message : e));
  } finally { window.__metamask_lock = false; }
}

const btn = document.getElementById('metamask-login-btn');
if (btn) btn.addEventListener('click', loginWithMetamask);
