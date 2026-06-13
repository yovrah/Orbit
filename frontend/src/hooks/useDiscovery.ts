import { useState, useCallback } from 'react';

export interface DiscoveredDevice {
  ip: string;
  port: number;
  name: string;
  os: string;
  version: string;
  paired: boolean;
}

export function useDiscovery() {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);

  const scanSubnet = useCallback(async (subnetBase: string = '192.168.1') => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    const found: DiscoveredDevice[] = [];

    // Sweep all 254 hosts concurrently with short abort timeouts
    const promises = Array.from({ length: 254 }, (_, i) => {
      const ip = `${subnetBase}.${i + 1}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      return fetch(`http://${ip}:23810/api/v1/ping`, { 
        signal: controller.signal,
        mode: 'cors'
      })
        .then(async (res) => {
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'online') {
              const dev: DiscoveredDevice = {
                ip,
                port: 23810,
                name: data.agent_name,
                os: data.os,
                version: data.version,
                paired: data.paired
              };
              found.push(dev);
              // Push discovered elements progressively
              setDiscoveredDevices(prev => {
                const exists = prev.some(d => d.ip === dev.ip);
                return exists ? prev : [...prev, dev];
              });
            }
          }
        })
        .catch(() => {
          clearTimeout(timeoutId);
        });
    });

    // Run standard subnets sweep
    await Promise.all(promises);
    setIsScanning(false);
    return found;
  }, []);

  return { isScanning, discoveredDevices, scanSubnet };
}
