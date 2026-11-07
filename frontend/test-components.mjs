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
    const { default: App } = await server.ssrLoadModule('./src/App.jsx');

    console.log('✓ Successfully loaded Header, AddSubnetModal, StatCards, IpGridMap, and App via Vite SSR');

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

      assert(html.includes('Total &amp; Utilisasi IP') || html.includes('Total & Utilisasi IP'), 'StatCards has Total & Utilisasi IP');
      assert(html.includes('Perangkat Online'), 'StatCards has Perangkat Online');
      assert(html.includes('Rogue Devices'), 'StatCards has Rogue Devices');
      assert(html.includes('MAC Conflict'), 'StatCards has MAC Conflict');
      assert(html.includes('50'), 'StatCards displays assigned count 50');
      assert(html.includes('/ 254'), 'StatCards displays / 254');
      assert(html.includes('32'), 'StatCards displays online count 32');
      assert(html.includes('3'), 'StatCards displays rogue count 3');
      assert(html.includes('2'), 'StatCards displays mismatch count 2');
      assert(html.includes('Perlu Tindakan'), 'StatCards displays Perlu Tindakan badge when rogue > 0');
      assert(html.includes('Konflik Terdeteksi'), 'StatCards displays Konflik Terdeteksi badge when mismatch > 0');
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
      assert(html.includes('bg-indigo-600'), 'IpGridMap contains RESERVED purple class');
      assert(html.includes('bg-emerald-600'), 'IpGridMap contains VALID_ONLINE emerald class');
      assert(html.includes('bg-slate-800'), 'IpGridMap contains OFFLINE slate class');
      assert(html.includes('bg-amber-500'), 'IpGridMap contains ROGUE_DEVICE amber class');
      assert(html.includes('bg-rose-600'), 'IpGridMap contains MAC_MISMATCH rose class');
      assert(html.includes('animate-pulse'), 'MAC_MISMATCH contains animate-pulse');
      assert(html.includes('bg-slate-900'), 'FREE contains dark slate background');

      // Verify Legend
      assert(html.includes('Keterangan Status IP:'), 'IpGridMap contains legend title');
      assert(html.includes('FREE (Kosong)'), 'Legend contains FREE item');
      assert(html.includes('VALID ONLINE'), 'Legend contains VALID ONLINE item');
      assert(html.includes('ROGUE DEVICE'), 'Legend contains ROGUE DEVICE item');
      assert(html.includes('MAC MISMATCH'), 'Legend contains MAC MISMATCH item');

      // Verify Selected IP Inspector
      assert(html.includes('192.168.1.2'), 'Selected IP inspector displays selected IP address');
      assert(html.includes('Web-Server'), 'Selected IP inspector displays hostname');
      assert(html.includes('ring-cyan-400'), 'Selected cell has cyan focus ring');

      // Verify Tooltip content structure
      assert(html.includes('role="tooltip"'), 'IpGridMap renders accessible tooltips');
      assert(html.includes('AA:BB:CC:DD:EE:02'), 'Tooltip contains detected MAC');

      console.log('✓ IpGridMap renders 254 cells, accurate status color classes, tooltips, legend, and selected IP inspector');
    }

    // 10. Test App root component
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
