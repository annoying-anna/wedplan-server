const http = require('http');

const runTest = () => {
  console.log('[Test Suite]: Verifying WedPlan backend endpoints...');
  http.get('http://localhost:5000/api/health', (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      const parsed = JSON.parse(data);
      if (parsed.status === 'healthy') {
        console.log('✓ Health check passed');
      } else {
        console.error('✗ Health check failed');
        process.exit(1);
      }
    });
  }).on('error', (err) => {
    console.error('✗ Server connection failed:', err.message);
    process.exit(1);
  });
};

runTest();
