const app = require('./app');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`Backend server running on http://${HOST}:${PORT}`);
  console.log(`Environment:`);
  console.log(`  APP_VERSION       : ${process.env.APP_VERSION || '1.0.0'}`);
  console.log(`  FAIL_HEALTH_CHECK : ${process.env.FAIL_HEALTH_CHECK || 'false'}`);
  console.log(`  POD_NAME          : ${process.env.POD_NAME || '(none - using hostname)'}`);
  console.log(`===============================================`);
});

// Graceful shutdown handling for container environments
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
