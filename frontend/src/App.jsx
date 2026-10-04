import React, { useState, useEffect, useCallback } from 'react';

export default function App() {
  const [status, setStatus] = useState('CHECKING...');
  const [isHealthy, setIsHealthy] = useState(null);
  const [version, setVersion] = useState('---');
  const [podName, setPodName] = useState('---');
  const [hostname, setHostname] = useState('---');
  const [applicationName, setApplicationName] = useState('kubernetes-self-healing-demo');
  const [lastChecked, setLastChecked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [requestHistory, setRequestHistory] = useState([]);
  const [errorDetails, setErrorDetails] = useState(null);

  // Check backend health via /api/health
  const checkHealth = useCallback(async () => {
    setLoading(true);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      if (response.ok && data.status === 'healthy') {
        setStatus('HEALTHY');
        setIsHealthy(true);
        if (data.version) setVersion(data.version);
        setErrorDetails(null);
        addLogEntry(timestamp, 'HEALTHY', podName !== '---' ? podName : 'backend');
      } else {
        setStatus('UNHEALTHY');
        setIsHealthy(false);
        setErrorDetails(data.error || `HTTP ${response.status} ${response.statusText}`);
        addLogEntry(timestamp, 'UNHEALTHY', data.pod || hostname || 'backend');
      }
    } catch (err) {
      setStatus('UNHEALTHY');
      setIsHealthy(false);
      setErrorDetails(err.message || 'Network / Connection error');
      addLogEntry(timestamp, 'DISCONNECTED', 'none');
    } finally {
      setLastChecked(timestamp);
      setLoading(false);
    }
  }, [podName, hostname]);

  // Retrieve backend information via /api/info
  const getBackendInfo = useCallback(async () => {
    setLoading(true);
    const timestamp = new Date().toLocaleTimeString();
    try {
      const response = await fetch('/api/info');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch backend info`);
      }
      const data = await response.json();
      setApplicationName(data.application || 'kubernetes-self-healing-demo');
      setVersion(data.version || 'unknown');
      setHostname(data.hostname || 'unknown');
      setPodName(data.pod || data.hostname || 'unknown');
      setStatus('HEALTHY');
      setIsHealthy(true);
      setErrorDetails(null);
      addLogEntry(timestamp, 'INFO FETCHED', data.pod || data.hostname);
    } catch (err) {
      setStatus('UNHEALTHY');
      setIsHealthy(false);
      setErrorDetails(err.message);
      addLogEntry(timestamp, 'ERROR', 'none');
    } finally {
      setLastChecked(timestamp);
      setLoading(false);
    }
  }, []);

  // Send 5 rapid requests to demonstrate Kubernetes round-robin load balancing
  const sendMultipleRequests = async () => {
    setLoading(true);
    try {
      for (let i = 0; i < 5; i++) {
        const timestamp = new Date().toLocaleTimeString();
        try {
          const res = await fetch('/api/info');
          const data = await res.json();
          addLogEntry(timestamp, `REQ #${i + 1}`, data.pod || data.hostname);
          setPodName(data.pod || data.hostname);
          setHostname(data.hostname);
          setVersion(data.version);
        } catch (e) {
          addLogEntry(timestamp, `REQ #${i + 1} FAILED`, 'none');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const addLogEntry = (time, result, pod) => {
    setRequestHistory((prev) => [
      { id: Date.now() + Math.random(), time, result, pod },
      ...prev.slice(0, 14) // keep last 15
    ]);
  };

  // Initial load
  useEffect(() => {
    getBackendInfo();
  }, [getBackendInfo]);

  // Auto-refresh interval (useful during self-healing and pod termination tests)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      getBackendInfo();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, getBackendInfo]);

  return (
    <div className="app-container">
      <header className="header">
        <span className="header-badge">DevOps mini Project</span>
        <h1 className="title">Kubernetes Self-Healing Demo — CI/CD</h1>
        <p className="subtitle">
          Full-Stack Microservices Architecture with Auto-Recovery & Rolling Updates
        </p>
      </header>

      {/* Key Status Overview Cards */}
      <section className="status-grid">
        <div className="card">
          <div className="card-label">Backend Status</div>
          <div className="card-value">
            {isHealthy === null ? (
              <span className="status-badge" style={{ background: '#334155', color: '#94a3b8' }}>
                {status}
              </span>
            ) : isHealthy ? (
              <span className="status-badge healthy">
                <span className="status-dot"></span>
                HEALTHY
              </span>
            ) : (
              <span className="status-badge unhealthy">
                <span className="status-dot"></span>
                UNHEALTHY
              </span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-label">App Version</div>
          <div className="card-value" style={{ color: '#38bdf8' }}>
            {version}
          </div>
        </div>

        <div className="card">
          <div className="card-label">Active Pod Name</div>
          <div className="card-value" style={{ color: '#a78bfa', fontSize: '1.05rem' }}>
            {podName}
          </div>
        </div>

        <div className="card">
          <div className="card-label">Host Name</div>
          <div className="card-value" style={{ color: '#fbcfe8', fontSize: '1.05rem' }}>
            {hostname}
          </div>
        </div>
      </section>

      {/* Interactive Controls */}
      <section className="actions-section">
        <button id="btn-check-health" onClick={checkHealth} disabled={loading}>
          <span>🩺</span> Check Backend Health (/api/health)
        </button>

        <button id="btn-get-info" className="secondary" onClick={getBackendInfo} disabled={loading}>
          <span>ℹ️</span> Retrieve Backend Info (/api/info)
        </button>

        <button
          id="btn-multi-request"
          className="secondary"
          onClick={sendMultipleRequests}
          disabled={loading}
          title="Fires 5 requests to reveal Kubernetes load distribution across Pod replicas"
        >
          <span>🔄</span> Send 5 Requests (Test Load Balancing)
        </button>

        <label className="auto-refresh-toggle">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-Poll (every 3s)
        </label>
      </section>

      {/* Error / Alert Display */}
      {errorDetails && (
        <div
          style={{
            background: 'rgba(220, 38, 38, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#fca5a5'
          }}
        >
          <strong>⚠️ Health Warning / Error:</strong> {errorDetails}
        </div>
      )}

      {/* Backend Details Table */}
      <section className="details-card">
        <h3>
          <span>Node.js Backend Details</span>
          {lastChecked && (
            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>
              Last checked: {lastChecked}
            </span>
          )}
        </h3>
        <table className="details-table">
          <tbody>
            <tr>
              <td>Application Name</td>
              <td>{applicationName}</td>
            </tr>
            <tr>
              <td>Configured Version</td>
              <td>{version}</td>
            </tr>
            <tr>
              <td>Serving Pod Identity</td>
              <td>{podName}</td>
            </tr>
            <tr>
              <td>Backend Hostname</td>
              <td>{hostname}</td>
            </tr>
            <tr>
              <td>Routing Mode</td>
              <td>Kubernetes Ingress → ClusterIP Service → Pod</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Live Replica Hit Log */}
      <section className="details-card">
        <h3>
          <span>Traffic & Replica Log</span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 400 }}>
            Demonstrates request distribution across Pod replicas
          </span>
        </h3>
        <div className="request-log">
          {requestHistory.length === 0 ? (
            <div style={{ color: '#64748b' }}>No requests recorded yet. Click a button above.</div>
          ) : (
            requestHistory.map((entry) => (
              <div key={entry.id} className="log-entry">
                <span className="log-time">[{entry.time}]</span>
                <span
                  className={`log-status ${entry.result.includes('HEALTHY') || entry.result.includes('INFO') || entry.result.includes('REQ')
                    ? 'healthy'
                    : 'unhealthy'
                    }`}
                >
                  {entry.result}
                </span>
                <span>→ Responder: <span className="log-pod">{entry.pod}</span></span>
              </div>
            ))
          )}
        </div>
      </section>

      <footer className="footer">
        DevOps Lab • Kubernetes Minikube • Drone CI/CD • Docker Multi-Stage Build
      </footer>
    </div>
  );
}
