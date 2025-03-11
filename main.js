const { db_ensure } = require('./tracker/db');
const { launch_server } = require('./core');

// Start function
async function start()
{
  try
  {
    await db_ensure();
    console.log('Database initialized');
    
    await launch_server();
  }
  catch (err)
  {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

// Start the application
start();