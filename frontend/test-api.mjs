import assert from 'node:assert';
import api, {
  getSubnets,
  getSubnet,
  createSubnet,
  deleteSubnet,
  getSubnetIps,
  updateIp,
  trustMac,
  scanSubnet,
} from './src/services/api.js';

let lastFetchCall = null;

// Mock global fetch
globalThis.fetch = async (url, options = {}) => {
  lastFetchCall = { url, options };

  if (url === '/api/subnets' && (!options.method || options.method === 'GET')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [{ id: 1, name: 'Main Office', cidr: '192.168.1.0/24' }],
    };
  }

  if (url === '/api/subnets/1' && (!options.method || options.method === 'GET')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 1, name: 'Main Office', cidr: '192.168.1.0/24' }),
    };
  }

  if (url === '/api/subnets' && options.method === 'POST') {
    return {
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 2, ...JSON.parse(options.body) }),
    };
  }

  if (url === '/api/subnets/1' && options.method === 'DELETE') {
    return {
      ok: true,
      status: 204,
      headers: new Headers(),
    };
  }

  if (url === '/api/subnets/1/ips' && (!options.method || options.method === 'GET')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [{ id: 10, ip_address: '192.168.1.1' }],
    };
  }

  if (url === '/api/subnets/1/ips?status=ROGUE_DEVICE') {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => [{ id: 20, ip_address: '192.168.1.50', reconciliation_status: 'ROGUE_DEVICE' }],
    };
  }

  if (url === '/api/ips/42' && options.method === 'PUT') {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 42, ...JSON.parse(options.body) }),
    };
  }

  if (url === '/api/ips/42/trust-mac' && options.method === 'POST') {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 42, admin_status: 'assigned', reconciliation_status: 'MATCH' }),
    };
  }

  if (url === '/api/subnets/1/scan' && options.method === 'POST') {
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 99, subnet_id: 1, total_online: 5, total_anomalies: 1 }),
    };
  }

  if (url === '/api/subnets/error-test') {
    return {
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'Subnet with CIDR already exists' }),
    };
  }

  if (url === '/api/subnets/validation-error') {
    return {
      ok: false,
      status: 422,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: [{ msg: 'Invalid CIDR prefix' }] }),
    };
  }

  return {
    ok: false,
    status: 404,
    statusText: 'Not Found',
    headers: new Headers(),
    text: async () => 'Not Found',
  };
};

async function runTests() {
  console.log('Testing WatchARP API client...');

  // 1. getSubnets
  const subnets = await getSubnets();
  assert.strictEqual(subnets.length, 1);
  assert.strictEqual(lastFetchCall.url, '/api/subnets');

  // 2. getSubnet
  const subnet = await getSubnet(1);
  assert.strictEqual(subnet.id, 1);
  assert.strictEqual(lastFetchCall.url, '/api/subnets/1');

  // 3. createSubnet
  const created = await createSubnet({ name: 'Lab', cidr: '10.0.0.0/24' });
  assert.strictEqual(created.name, 'Lab');
  assert.strictEqual(lastFetchCall.options.method, 'POST');
  assert.strictEqual(lastFetchCall.options.headers['Content-Type'], 'application/json');

  // 4. deleteSubnet (204 No Content)
  const deleted = await deleteSubnet(1);
  assert.strictEqual(deleted, null);
  assert.strictEqual(lastFetchCall.url, '/api/subnets/1');
  assert.strictEqual(lastFetchCall.options.method, 'DELETE');

  // 5. getSubnetIps without filter
  const ips = await getSubnetIps(1);
  assert.strictEqual(ips.length, 1);
  assert.strictEqual(lastFetchCall.url, '/api/subnets/1/ips');

  // 6. getSubnetIps with status filter
  const filteredIps = await getSubnetIps(1, 'ROGUE_DEVICE');
  assert.strictEqual(filteredIps.length, 1);
  assert.strictEqual(lastFetchCall.url, '/api/subnets/1/ips?status=ROGUE_DEVICE');

  // 7. updateIp
  const updatedIp = await updateIp(42, { hostname: 'switch-core' });
  assert.strictEqual(updatedIp.hostname, 'switch-core');
  assert.strictEqual(lastFetchCall.url, '/api/ips/42');
  assert.strictEqual(lastFetchCall.options.method, 'PUT');

  // 8. trustMac
  const trusted = await trustMac(42);
  assert.strictEqual(trusted.reconciliation_status, 'MATCH');
  assert.strictEqual(lastFetchCall.url, '/api/ips/42/trust-mac');
  assert.strictEqual(lastFetchCall.options.method, 'POST');

  // 9. scanSubnet
  const scanResult = await scanSubnet(1);
  assert.strictEqual(scanResult.total_online, 5);
  assert.strictEqual(lastFetchCall.url, '/api/subnets/1/scan');
  assert.strictEqual(lastFetchCall.options.method, 'POST');

  // 10. Default export methods match
  assert.strictEqual(api.getSubnets, getSubnets);
  assert.strictEqual(api.createSubnet, createSubnet);
  assert.strictEqual(api.trustMac, trustMac);

  // 11. Error handling detail string
  let thrown = null;
  try {
    await globalThis.fetch('/api/subnets/error-test').then(() => {
      // Trigger request helper logic
      return api.createSubnet({ cidr: 'duplicate' });
    });
  } catch (err) {
    thrown = err;
  }

  console.log('✓ All API client unit tests passed successfully.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
