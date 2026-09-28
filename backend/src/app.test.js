const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('./app');

describe('Backend API Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FAIL_HEALTH_CHECK;
    delete process.env.APP_VERSION;
    delete process.env.POD_NAME;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('GET / returns API welcome and endpoint listing', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Kubernetes Self-Healing Demo Backend API');
    assert.ok(Array.isArray(res.body.endpoints));
  });

  test('GET /api/health returns healthy (200) when FAIL_HEALTH_CHECK is unset or false', async () => {
    process.env.APP_VERSION = '1.0.0';
    process.env.FAIL_HEALTH_CHECK = 'false';

    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.equal(res.body.version, '1.0.0');
  });

  test('GET /api/health returns unhealthy (500) when FAIL_HEALTH_CHECK is true', async () => {
    process.env.APP_VERSION = '1.0.0';
    process.env.FAIL_HEALTH_CHECK = 'true';

    const res = await request(app).get('/api/health');
    assert.equal(res.status, 500);
    assert.equal(res.body.status, 'unhealthy');
    assert.equal(res.body.version, '1.0.0');
    assert.ok(res.body.error);
  });

  test('GET /api/info returns application info with dynamic hostname and version', async () => {
    process.env.APP_VERSION = '2.1.0';
    process.env.POD_NAME = 'backend-pod-test-123';

    const res = await request(app).get('/api/info');
    assert.equal(res.status, 200);
    assert.equal(res.body.application, 'kubernetes-self-healing-demo');
    assert.equal(res.body.version, '2.1.0');
    assert.equal(res.body.pod, 'backend-pod-test-123');
    assert.ok(typeof res.body.hostname === 'string' && res.body.hostname.length > 0);
  });
});
