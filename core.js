const express = require('express');
const cors = require('cors');
const run_handlers = require('./tracker/handler');

const app = express();
const port = 8000;

async function launch_server()
{
  app.use(express.json()); // To handle JSON request bodies
  app.use(cors());

  await run_handlers(app);
  console.log('Handlers initialized');

  // Connect
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

// Export the pool
module.exports = {
  app,
  launch_server
};