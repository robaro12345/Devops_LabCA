const express = require('express');
const cors = require('cors');
const os = require('os');

const app = express();

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Kubernetes Self-Healing Demo Backend API',
    endpoints: ['/api/health', '/api/info']
  });
});

// GET /api/health
// Used by Kubernetes liveness and readiness probes
app.get('/api/health', (req, res) => {
  const version = process.env.APP_VERSION || '1.0.0';
  const shouldFail = process.env.FAIL_HEALTH_CHECK === 'true';

  if (shouldFail) {
    return res.status(500).json({
      status: 'unhealthy',
      version: version,
      error: 'Simulated health check failure (FAIL_HEALTH_CHECK=true)'
    });
  }

  return res.status(200).json({
    status: 'healthy',
    version: version
  });
});

// GET /api/info
// Returns application metadata and dynamic host/pod identity
app.get('/api/info', (req, res) => {
  const version = process.env.APP_VERSION || '1.0.0';
  const hostname = os.hostname();
  const pod = process.env.POD_NAME || hostname;

  return res.status(200).json({
    application: 'kubernetes-self-healing-demo',
    version: version,
    hostname: hostname,
    pod: pod
  });
});

module.exports = app;
