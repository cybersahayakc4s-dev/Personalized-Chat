const { spawn } = require('child_process');
const path = require('path');

const ELECTRON_PATH = 'c:\\Users\\Pc\\Documents\\Personalize-Chat [FOR PRODUCITON]\\node_modules\\electron\\dist\\electron.exe';
const APP_PATH = 'c:\\Users\\Pc\\Documents\\Personalize-Chat [FOR PRODUCITON]';

const proc = spawn(ELECTRON_PATH, [APP_PATH], { stdio: 'inherit' });

(async () => {
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch('http://127.0.0.1:9222/json');
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));

  let id = 1;
  const send = (expr) => new Promise((resolve) => {
    const curId = id++;
    const handler = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  });

  const token = await send('window.electronAPI ? await window.electronAPI.getRefreshToken() : "no_api"');
  console.log('GET REFRESH TOKEN RESULT:', token?.result?.value);

  const authErr = await send('window.__last_init_auth_error');
  console.log('LAST AUTH ERR:', authErr?.result?.value);

  const body = await send('document.body.innerText.slice(0, 150)');
  console.log('BODY:', JSON.stringify(body?.result?.value));

  ws.close();
  proc.kill('SIGTERM');
  process.exit(0);
})();
