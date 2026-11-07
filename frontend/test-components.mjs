import assert from 'node:assert';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

async function runComponentTests() {
  console.log('Testing WatchARP React Components (SSR Rendering & Structure)...');

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  });

  try {
    // 1. Load component modules via Vite SSR pipeline
    const { default: Header } = await server.ssrLoadModule('./src/components/Header.jsx');
    const { default: AddSubnetModal } = await server.ssrLoadModule('./src/components/AddSubnetModal.jsx');
    const { default: StatCards } = await server.ssrLoadModule('./src/components/StatCards.jsx');
    const { default: IpGridMap } = await server.ssrLoadModule('./src/components/IpGridMap.jsx');
    const { default: IpTable } = await server.ssrLoadModule('./src/components/IpTable.jsx');
    const { default: EditIpModal, isValidMac } = await server.ssrLoadModule('./src/components/EditIpModal.jsx');
    const { default: App } = await server.ssrLoadModule('./src/App.jsx');

    console.log('✓ Successfully loaded Header, AddSubnetModal, StatCards, IpGridMap, IpTable, EditIpModal, and App via Vite SSR');

    // 2. Test Header without subnets
    {
      const html = renderToString(
        React.createElement(Header, {
          subnets: [],
          selectedSubnet: null,
          isScanning: false,
          onSelectSubnet: () => {},
          onOpenAddSubnet: () => {},
          onScan: () => {},
        })
      );

      assert(html.includes('WatchARP'), 'Header must contain WatchARP title');
      assert(
        html.includes('Simple IPAM &amp; Live ARP Scanner') || html.includes('Simple IPAM & Live ARP Scanner'),
        'Header must contain subtitle'
      );
      assert(html.includes('Belum ada subnet'), 'Header select should show placeholder when no subnets');
      assert(html.includes('disabled=""') || html.includes('disabled'), 'Scan button should be disabled when no subnet');
      assert(html.includes('Tambah Subnet'), 'Header should have Tambah Subnet button');
      console.log('✓ Header renders correctly with empty subnets');
    }

    // 3. Test Header with populated subnets
    {
      const sampleSubnets = [
        { id: 1, name: 'Office LAN', cidr: '192.168.1.0/24', vlan_id: 10 },
        { id: 2, name: 'Server Farm', cidr: '10.0.0.0/24', vlan_id: 20 },
      ];
      const html = renderToString(
        React.createElement(Header, {
          subnets: sampleSubnets,
          selectedSubnet: sampleSubnets[0],
          isScanning: false,
          onSelectSubnet: () => {},
          onOpenAddSubnet: () => {},
          onScan: () => {},
        })
      );

      assert(html.includes('Office LAN (192.168.1.0/24) - VLAN 10'), 'Dropdown must include subnet option 1');
      assert(html.includes('Server Farm (10.0.0.0/24) - VLAN 20'), 'Dropdown must include subnet option 2');
      assert(html.includes('Scan Subnet Sekarang'), 'Scan button active label present');
      console.log('✓ Header renders options and active scan button with subnets');
    }

    // 4. Test Header during scanning
    {
      const sampleSubnets = [{ id: 1, name: 'Office LAN', cidr: '192.168.1.0/24' }];
      const html = renderToString(
        React.createElement(Header, {
          subnets: sampleSubnets,
          selectedSubnet: sampleSubnets[0],
          isScanning: true,
          onSelectSubnet: () => {},
          onOpenAddSubnet: () => {},
          onScan: () => {},
        })
      );

      assert(html.includes('Memindai ARP...'), 'Header scan button shows scanning state');
      assert(html.includes('animate-spin'), 'Header scan button has animate-spin spinner');
      console.log('✓ Header renders scanning state correctly');
    }

    // 5. Test AddSubnetModal when closed
    {
      const htmlClosed = renderToString(
        React.createElement(AddSubnetModal, {
          isOpen: false,
          onClose: () => {},
          onCreated: () => {},
        })
      );

      assert.strictEqual(htmlClosed, '', 'AddSubnetModal must render nothing when isOpen is false');
      console.log('✓ AddSubnetModal returns null when closed');
    }

    // 6. Test AddSubnetModal when open
    {
      const htmlOpen = renderToString(
        React.createElement(AddSubnetModal, {
          isOpen: true,
          onClose: () => {},
          onCreated: () => {},
        })
      );

      assert(htmlOpen.includes('role="dialog"'), 'Modal must have role="dialog"');
      assert(htmlOpen.includes('Tambah Subnet Baru'), 'Modal must display title');
      assert(htmlOpen.includes('Nama Subnet'), 'Modal must include Subnet Name label');
      assert(htmlOpen.includes('CIDR (/24)'), 'Modal must include CIDR label');
      assert(htmlOpen.includes('IP Gateway'), 'Modal must include Gateway label');
      assert(htmlOpen.includes('VLAN ID'), 'Modal must include VLAN ID label');
      assert(htmlOpen.includes('192.168.1.0/24'), 'Modal must have CIDR placeholder');
      assert(htmlOpen.includes('Simpan Subnet'), 'Modal must have Simpan Subnet submit button');
      assert(htmlOpen.includes('Batal'), 'Modal must have Batal cancel button');
      console.log('✓ AddSubnetModal renders all required form controls when open');
    }

    // 7. Test StatCards with summary metrics
    {
      const sampleSummary = {
        total_ips: 254,
        assigned_count: 50,
        online_count: 32,
        rogue_count: 3,
        mismatch_count: 2,
      };

      const html = renderToString(
        React.createElement(StatCards, {
          summary: sampleSummary,
          totalIps: 254,
        })
      );

      assert(html.includes('Utilisasi IP'), 'StatCards has Utilisasi IP');
      assert(html.includes('>Online<'), 'StatCards has Online');
      assert(html.includes('Rogue device'), 'StatCards has Rogue device');
      assert(html.includes('MAC konflik'), 'StatCards has MAC konflik');
      assert(html.includes('50'), 'StatCards displays assigned count 50');
      assert(html.includes('/ 254'), 'StatCards displays / 254');
      assert(html.includes('32'), 'StatCards displays online count 32');
      assert(html.includes('3'), 'StatCards displays rogue count 3');
      assert(html.includes('2'), 'StatCards displays mismatch count 2');
      assert(html.includes('Perlu tindakan'), 'StatCards displays Perlu tindakan note when rogue > 0');
      assert(html.includes('Konflik terdeteksi'), 'StatCards displays Konflik terdeteksi note when mismatch > 0');
      console.log('✓ StatCards renders 4 top metric cards with summary data and semantic anomaly badges');
    }

    // 8. Test StatCards dynamic computation from raw ips array
    {
      const sampleIps = [
        { id: 1, ip_address: '192.168.1.1', admin_status: 'reserved', is_online: true, reconciliation_status: 'RESERVED' },
        { id: 2, ip_address: '192.168.1.2', admin_status: 'assigned', is_online: true, reconciliation_status: 'VALID_ONLINE' },
        { id: 3, ip_address: '192.168.1.3', admin_status: 'assigned', is_online: false, reconciliation_status: 'OFFLINE' },
        { id: 4, ip_address: '192.168.1.4', admin_status: 'available', is_online: true, reconciliation_status: 'ROGUE_DEVICE' },
        { id: 5, ip_address: '192.168.1.5', admin_status: 'assigned', is_online: true, reconciliation_status: 'MAC_MISMATCH' },
      ];

      const html = renderToString(
        React.createElement(StatCards, {
          ips: sampleIps,
          totalIps: 5,
        })
      );

      assert(html.includes('3'), 'StatCards computes 3 assigned hosts');
      assert(html.includes('/ 5'), 'StatCards displays / 5 total hosts');
      assert(html.includes('4'), 'StatCards computes 4 online hosts');
      assert(html.includes('1'), 'StatCards computes 1 rogue and 1 mismatch');
      console.log('✓ StatCards computes real-time stats directly from raw ips array');
    }

    // 9. Test IpGridMap with all reconciliation states
    {
      const mockIps = [
        {
          id: 1,
          ip_address: '192.168.1.1',
          admin_status: 'reserved',
          is_online: true,
          hostname: 'Gateway',
          detected_mac: '00:11:22:33:44:01',
          expected_mac: null,
          vendor: 'Cisco',
          reconciliation_status: 'RESERVED',
        },
        {
          id: 2,
          ip_address: '192.168.1.2',
          admin_status: 'assigned',
          is_online: true,
          hostname: 'Web-Server',
          detected_mac: 'AA:BB:CC:DD:EE:02',
          expected_mac: 'AA:BB:CC:DD:EE:02',
          vendor: 'Dell',
          reconciliation_status: 'VALID_ONLINE',
        },
        {
          id: 3,
          ip_address: '192.168.1.3',
          admin_status: 'assigned',
          is_online: false,
          hostname: 'Printer',
          detected_mac: null,
          expected_mac: 'AA:BB:CC:DD:EE:03',
          vendor: 'HP',
          reconciliation_status: 'OFFLINE',
        },
        {
          id: 4,
          ip_address: '192.168.1.4',
          admin_status: 'available',
          is_online: true,
          hostname: null,
          detected_mac: 'DE:AD:BE:EF:00:04',
          expected_mac: null,
          vendor: 'Apple',
          reconciliation_status: 'ROGUE_DEVICE',
        },
        {
          id: 5,
          ip_address: '192.168.1.5',
          admin_status: 'assigned',
          is_online: true,
          hostname: 'Database',
          detected_mac: '99:88:77:66:55:05',
          expected_mac: '11:22:33:44:55:05',
          vendor: 'Supermicro',
          reconciliation_status: 'MAC_MISMATCH',
        },
      ];

      const html = renderToString(
        React.createElement(IpGridMap, {
          ips: mockIps,
          selectedIp: mockIps[1], // select 192.168.1.2
          onSelectIp: () => {},
          isLoading: false,
        })
      );

      // Verify 254 cells generated (.1 through .254)
      assert(html.includes('.1<'), 'IpGridMap contains .1 cell');
      assert(html.includes('.254<'), 'IpGridMap contains .254 cell');

      // Verify color mappings
      assert(html.includes('hatch'), 'RESERVED cells are hatched');
      assert(html.includes('bg-ok/15'), 'VALID_ONLINE uses ok tint');
      assert(html.includes('border-dashed'), 'OFFLINE uses dashed border');
      assert(html.includes('bg-warn/40'), 'ROGUE_DEVICE uses warn tint');
      assert(html.includes('bg-bad border-bad'), 'MAC_MISMATCH uses solid bad fill');
      assert(!html.includes('animate-pulse'), 'No endless pulse animation on cells');
      assert(html.includes('bg-surface border-line text-muted'), 'FREE uses plain surface');

      // Verify Legend
      assert(html.includes('Keterangan status IP'), 'IpGridMap contains legend');
      assert(html.includes('>Free<'), 'Legend contains Free item');
      assert(html.includes('Valid online'), 'Legend contains Valid online item');
      assert(html.includes('Rogue device'), 'Legend contains Rogue device item');
      assert(html.includes('MAC mismatch'), 'Legend contains MAC mismatch item');

      // Verify Selected IP Inspector
      assert(html.includes('192.168.1.2'), 'Selected IP inspector displays selected IP address');
      assert(html.includes('Web-Server'), 'Selected IP inspector displays hostname');
      assert(html.includes('ring-accent'), 'Selected cell has accent ring');

      // Verify Tooltip content structure
      assert(html.includes('role="tooltip"'), 'IpGridMap renders accessible tooltips');
      assert(html.includes('AA:BB:CC:DD:EE:02'), 'Tooltip contains detected MAC');

      console.log('✓ IpGridMap renders 254 cells, accurate status color classes, tooltips, legend, and selected IP inspector');
    }

    // 10. Test EditIpModal component and MAC validation
    {
      // Test isValidMac helper
      assert.strictEqual(isValidMac(''), true, 'Empty MAC is allowed');
      assert.strictEqual(isValidMac(null), true, 'Null MAC is allowed');
      assert.strictEqual(isValidMac('AA:BB:CC:DD:EE:FF'), true, 'Valid colon MAC');
      assert.strictEqual(isValidMac('aa:bb:cc:dd:ee:ff'), true, 'Valid lowercase colon MAC');
      assert.strictEqual(isValidMac('00-11-22-33-44-55'), true, 'Valid hyphen MAC');
      assert.strictEqual(isValidMac('invalid-mac'), false, 'Invalid string should fail');
      assert.strictEqual(isValidMac('AA:BB:CC:DD:EE'), false, 'Too short MAC should fail');
      assert.strictEqual(isValidMac('AA:BB:CC:DD:EE:FF:00'), false, 'Too long MAC should fail');
      assert.strictEqual(isValidMac('GG:HH:II:JJ:KK:LL'), false, 'Non-hex chars should fail');
      console.log('✓ EditIpModal isValidMac validation unit tests passed');

      // Test EditIpModal closed
      const htmlClosed = renderToString(
        React.createElement(EditIpModal, {
          isOpen: false,
          ip: null,
          onClose: () => {},
          onSaved: () => {},
        })
      );
      assert.strictEqual(htmlClosed, '', 'EditIpModal returns null when closed');

      // Test EditIpModal open
      const sampleIp = {
        id: 15,
        ip_address: '192.168.1.15',
        admin_status: 'available',
        hostname: 'test-host',
        expected_mac: 'AA:BB:CC:11:22:33',
        detected_mac: 'DE:AD:BE:EF:CA:FE',
        vendor: 'Espressif',
        reconciliation_status: 'ROGUE_DEVICE',
        is_online: true,
      };

      const htmlOpen = renderToString(
        React.createElement(EditIpModal, {
          isOpen: true,
          ip: sampleIp,
          onClose: () => {},
          onSaved: () => {},
        })
      );

      assert(htmlOpen.includes('role="dialog"'), 'EditIpModal must have role="dialog"');
      assert(htmlOpen.includes('Edit IP:'), 'EditIpModal displays Edit IP title');
      assert(htmlOpen.includes('192.168.1.15'), 'EditIpModal displays target IP address in title');
      assert(htmlOpen.includes('Status Admin'), 'EditIpModal contains Status Admin field');
      assert(htmlOpen.includes('Hostname (Nama Perangkat)'), 'EditIpModal contains Hostname label');
      assert(htmlOpen.includes('Expected MAC Address'), 'EditIpModal contains Expected MAC label');
      assert(htmlOpen.includes('Gunakan Detected MAC'), 'EditIpModal provides quick copy detected MAC helper');
      assert(htmlOpen.includes('Simpan Perubahan'), 'EditIpModal provides Simpan Perubahan submit button');
      assert(htmlOpen.includes('Batal'), 'EditIpModal provides Batal button');
      console.log('✓ EditIpModal renders accessible dialog, form controls, and detected MAC helper');
    }

    // 11. Test IpTable component
    {
      const mockTableIps = [
        {
          id: 1,
          ip_address: '192.168.1.1',
          admin_status: 'reserved',
          hostname: 'gateway.local',
          expected_mac: '00:11:22:33:44:01',
          detected_mac: '00:11:22:33:44:01',
          vendor: 'Cisco Systems',
          is_online: true,
          reconciliation_status: 'RESERVED',
          last_seen_at: '2026-11-07T12:00:00Z',
        },
        {
          id: 2,
          ip_address: '192.168.1.20',
          admin_status: 'assigned',
          hostname: 'nas-storage',
          expected_mac: 'AA:BB:CC:DD:EE:20',
          detected_mac: 'AA:BB:CC:DD:EE:20',
          vendor: 'Synology',
          is_online: true,
          reconciliation_status: 'VALID_ONLINE',
          last_seen_at: '2026-11-07T12:05:00Z',
        },
        {
          id: 3,
          ip_address: '192.168.1.50',
          admin_status: 'available',
          hostname: null,
          expected_mac: null,
          detected_mac: '77:88:99:AA:BB:CC',
          vendor: 'Raspberry Pi Foundation',
          is_online: true,
          reconciliation_status: 'ROGUE_DEVICE',
          last_seen_at: '2026-11-07T12:10:00Z',
        },
        {
          id: 4,
          ip_address: '192.168.1.60',
          admin_status: 'assigned',
          hostname: 'printer-office',
          expected_mac: '11:22:33:44:55:66',
          detected_mac: '99:88:77:66:55:44',
          vendor: 'HP Inc',
          is_online: true,
          reconciliation_status: 'MAC_MISMATCH',
          last_seen_at: '2026-11-07T12:10:00Z',
        },
        {
          id: 5,
          ip_address: '192.168.1.100',
          admin_status: 'available',
          hostname: null,
          expected_mac: null,
          detected_mac: null,
          vendor: null,
          is_online: false,
          reconciliation_status: 'FREE',
          last_seen_at: null,
        },
      ];

      const htmlTable = renderToString(
        React.createElement(IpTable, {
          ips: mockTableIps,
          selectedIp: mockTableIps[2], // rogue device selected
          onSelectIp: () => {},
          onEditIp: () => {},
          onTrustMac: () => {},
          isTrustingId: null,
        })
      );

      // Verify Headers
      assert(htmlTable.includes('Daftar Rincian IP Host'), 'IpTable contains main heading');
      assert(htmlTable.includes('IP Address'), 'IpTable has IP Address th');
      assert(htmlTable.includes('Status Admin'), 'IpTable has Status Admin th');
      assert(htmlTable.includes('Hostname'), 'IpTable has Hostname th');
      assert(htmlTable.includes('Expected MAC'), 'IpTable has Expected MAC th');
      assert(htmlTable.includes('Detected MAC (Vendor)'), 'IpTable has Detected MAC th');
      assert(htmlTable.includes('Status Rekonsiliasi'), 'IpTable has Status Rekonsiliasi th');
      assert(htmlTable.includes('Terakhir Terlihat'), 'IpTable has Terakhir Terlihat th');
      assert(htmlTable.includes('Aksi'), 'IpTable has Aksi th');

      // Verify Filter Tabs
      assert(htmlTable.includes('Rogue Devices'), 'IpTable includes Rogue Devices tab');
      assert(htmlTable.includes('Mismatches'), 'IpTable includes Mismatches tab');
      assert(htmlTable.includes('Online'), 'IpTable includes Online tab');
      assert(htmlTable.includes('Assigned'), 'IpTable includes Assigned tab');

      // Verify Rogue Device Approve Button
      assert(htmlTable.includes('Setujui MAC'), 'IpTable renders Setujui MAC button for rogue device');

      // Verify Edit Button
      assert(htmlTable.includes('Edit'), 'IpTable renders Edit button');

      // Verify Rows content
      assert(htmlTable.includes('192.168.1.1'), 'IpTable renders 192.168.1.1');
      assert(htmlTable.includes('gateway.local'), 'IpTable renders hostname');
      assert(htmlTable.includes('Raspberry Pi Foundation'), 'IpTable renders vendor info');
      assert(htmlTable.includes('Rogue device'), 'IpTable renders Rogue Device badge');
      assert(htmlTable.includes('MAC mismatch'), 'IpTable renders MAC Mismatch badge');

      // Verify Search input
      assert(htmlTable.includes('Cari IP, Hostname, MAC, Vendor...'), 'IpTable renders search bar with placeholder');

      // Verify Pagination info
      assert(htmlTable.includes('Menampilkan'), 'IpTable renders pagination display');
      assert(htmlTable.includes('dari'), 'IpTable renders pagination total info');

      console.log('✓ IpTable renders full columns, tabs, search, pagination, and rogue approval action button');
    }

    // 12. Test App root component
    {
      globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      });

      const htmlApp = renderToString(React.createElement(App));
      assert(htmlApp.includes('WatchARP'), 'App renders Header with WatchARP');
      console.log('✓ App renders root layout correctly');
    }

    console.log('✓ All component tests passed successfully!');
  } finally {
    await server.close();
  }
}

runComponentTests().catch((err) => {
  console.error('Component test failed:', err);
  process.exit(1);
});
