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
    const { default: App } = await server.ssrLoadModule('./src/App.jsx');

    console.log('✓ Successfully loaded Header, AddSubnetModal, and App via Vite SSR');

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

    // 7. Test App root component
    {
      // Mock global fetch for App's useEffect
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
