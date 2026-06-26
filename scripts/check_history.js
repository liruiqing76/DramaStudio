const http = require('http');
const promptId = '241d84a2-a228-4ce3-890a-8def116a16a8';

http.get(`http://localhost:8188/history/${promptId}`, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const d = JSON.parse(data);
    const k = Object.keys(d)[0];
    if (!k) {
      console.log('No history found');
      return;
    }
    const s = d[k].status;
    console.log('status_str:', s.status_str);
    console.log('completed:', s.completed);
    const err = s.messages.find(m => m[0] === 'execution_error');
    if (err) {
      console.log('\nERROR:', err[1].exception_message);
      console.log('node_type:', err[1].node_type);
      console.log('node_id:', err[1].node_id);
    } else {
      const progress = s.messages.filter(m => m[0] === 'progress');
      if (progress.length) {
        const last = progress[progress.length - 1][1];
        console.log('\nProgress:', last.current, '/', last.total);
      }
      console.log('\nLast 5 messages:', s.messages.slice(-5).map(m => m[0]));
    }
  });
}).on('error', e => console.error('Error:', e.message));