const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function getAvailablePort(startPort = 8080) {
  return new Promise((resolve, reject) => {
    const testPort = (port) => {
      const server = net.createServer();

      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          testPort(port + 1);
          return;
        }
        reject(err);
      });

      server.listen(port, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
      });
    };

    testPort(startPort);
  });
}

function waitForServer(url, retries = 60) {
  return new Promise((resolve, reject) => {
    const tryOnce = (left) => {
      http
        .get(url, () => resolve())
        .on('error', () => {
          if (left <= 0) return reject(new Error('Vite dev server 启动超时'));
          setTimeout(() => tryOnce(left - 1), 500);
        });
    };
    tryOnce(retries);
  });
}

(async () => {
  const port = await getAvailablePort();
  const DEV_URL = `http://localhost:${port}`;

  console.log(`[dev] Vite 启动端口: ${port}`);

  const vite = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(port)], {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
  });

  waitForServer(DEV_URL)
    .then(() => {
      const electron = spawn('npx', ['electron', '.'], {
        cwd: ROOT,
        shell: true,
        stdio: 'inherit',
        env: { ...process.env, VITE_DEV_SERVER_URL: DEV_URL },
      });
      electron.on('close', () => {
        vite.kill();
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error(err.message);
      vite.kill();
      process.exit(1);
    });

  process.on('SIGINT', () => {
    vite.kill();
    process.exit(0);
  });
})();
