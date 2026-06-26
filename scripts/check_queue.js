const http = require('http');

http.get('http://localhost:8188/queue', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    console.log('Queue running:', d.queue_running.length);
    console.log('Queue pending:', d.queue_pending.length);
    if (d.queue_running.length) {
      console.log('Running prompt_ids:', d.queue_running.map(p => p.prompt_id));
    }
  });
}).on('error', e => console.error('Error:', e.message));