const express = require('express');
const app = express();

app.use(express.json());

app.all('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    test: 'API route working'
  });
});

app.get('/', (req, res) => {
  res.send('Hello World');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}`);
});
