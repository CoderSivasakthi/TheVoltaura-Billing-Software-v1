const WebSocket = require('ws');
const fs = require('fs');

const wsUrl = 'ws://localhost:9229/3b5cef76-e4ac-4ad6-a308-219149450c54';
const ws = new WebSocket(wsUrl);

let id = 1;
function send(method, params) {
  ws.send(JSON.stringify({ id: id++, method, params }));
}

ws.on('open', () => {
  send('Debugger.enable');
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.method === 'Debugger.scriptParsed') {
    if (msg.params.url.endsWith('server.js') && !msg.params.url.includes('node_modules')) {
      send('Debugger.getScriptSource', { scriptId: msg.params.scriptId });
    }
  } else if (msg.result && msg.result.scriptSource) {
    fs.writeFileSync('server_recovered.js', msg.result.scriptSource);
    console.log('RECOVERED');
    process.exit(0);
  }
});
