/**
 * WatchARP API Service Client
 * Standardized fetch wrapper for backend communication.
 */

const API_BASE = '/api';

/**
 * Perform an HTTP request to the WatchARP API.
 * Handles JSON serialization, 204 No Content, and structured backend error responses.
 */
async function request(path, options = {}) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = cleanPath.startsWith(API_BASE) ? cleanPath : `${API_BASE}${cleanPath}`;

  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data.detail)) {
        message = data.detail.map((err) => err.msg || JSON.stringify(err)).join(', ');
      } else if (data.message) {
        message = data.message;
      }
    } else if (typeof data === 'string' && data.trim()) {
      message = data;
    } else if (response.statusText) {
      message = response.statusText;
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetch all subnets with summary metrics.
 * @returns {Promise<Array>} List of subnet summary objects
 */
export async function getSubnets() {
  return request('/subnets');
}

/**
 * Fetch a specific subnet by ID.
 * @param {number|string} id - Subnet ID
 * @returns {Promise<Object>} Subnet details
 */
export async function getSubnet(id) {
  return request(`/subnets/${id}`);
}

/**
 * Create a new subnet.
 * @param {Object} data - { name, cidr, gateway?, vlan_id? }
 * @returns {Promise<Object>} Created subnet record
 */
export async function createSubnet(data) {
  return request('/subnets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a subnet and all its associated IP addresses.
 * @param {number|string} id - Subnet ID
 * @returns {Promise<null>}
 */
export async function deleteSubnet(id) {
  return request(`/subnets/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch all 254 host IP addresses for a subnet, optionally filtered by status.
 * @param {number|string} subnetId - Subnet ID
 * @param {string} [statusFilter] - Optional reconciliation_status filter
 * @returns {Promise<Array>} List of IP address objects
 */
export async function getSubnetIps(subnetId, statusFilter) {
  const query = statusFilter && statusFilter.trim()
    ? `?status=${encodeURIComponent(statusFilter.trim())}`
    : '';
  return request(`/subnets/${subnetId}/ips${query}`);
}

/**
 * Update IP address details (expected MAC, admin status, hostname, description).
 * @param {number|string} id - IP record ID
 * @param {Object} data - Updated IP properties
 * @returns {Promise<Object>} Updated IP address object
 */
export async function updateIp(id, data) {
  return request(`/ips/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Trust the detected MAC for an IP (sets expected_mac = detected_mac, admin_status = 'assigned').
 * @param {number|string} id - IP record ID
 * @returns {Promise<Object>} Updated IP address object
 */
export async function trustMac(id) {
  return request(`/ips/${id}/trust-mac`, {
    method: 'POST',
  });
}

/**
 * Trigger an ARP live scan on a subnet.
 * @param {number|string} subnetId - Subnet ID
 * @returns {Promise<Object>} Scan history entry
 */
export async function scanSubnet(subnetId) {
  return request(`/subnets/${subnetId}/scan`, {
    method: 'POST',
  });
}

export const api = {
  getSubnets,
  getSubnet,
  createSubnet,
  deleteSubnet,
  getSubnetIps,
  updateIp,
  trustMac,
  scanSubnet,
};

export default api;
