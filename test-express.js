const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/{*path}', (req, res) => {
  res.send('SPA fallback');
});

app.listen(3001, () => {
  console.log('Test server running on port 3001');
});
