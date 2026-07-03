import { useState, useCallback } from 'react';
import { db } from '../db/clientDb';

export interface DiscoveredDevice {
  ip: string;
  port: number;
  name: string;
  os: string;
  version: string;
  paired: boolean;
}

const COMMON_SUBNETS = ['192.168.0', '192.168.1', '10.0.0'];

function subnetOf(hostOrUrl: string): string | null {
  const host = hostOrUrl.replace(/^https?:\/\//, '').replace(/:\d+.*$/, '');
  const m = host.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  return m ? m[1] : null;
}

/** Subnets worth sweeping, most-likely first: the one this page was served
 * from (when opened from the agent, that IS the LAN), then subnets of every
 * previously paired PC, then the common home-router defaults. */
async function candidateSubnets(): Promise<string[]> {
  const bases: string[] = [];
  const push = (b: string | null) => {
    if (b && !bases.includes(b)) bases.push(b);
  };

  push(subnetOf(window.location.hostname));
  try {
    const devices = await db.devices.toArray();
    devices.forEach((d) => push(subnetOf(d.ipAddress)));
  } catch {
    /* ignore — fall through to common subnets */
  }
  COMMON_SUBNETS.forEach((b) => push(b));
  return bases;
}

export function useDiscovery() {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);

  const scanSubnet = useCallback(async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    const found: DiscoveredDevice[] = [];

    const sweep = async (subnetBase: string) => {
      // Sweep all 254 hosts concurrently with short abort timeouts.
      const promises = Array.from({ length: 254 }, (_, i) => {
        const ip = `${subnetBase}.${i + 1}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        return fetch(`http://${ip}:23810/api/v1/ping`, {
          signal: controller.signal,
          mode: 'cors',
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
                  paired: data.paired,
                };
                found.push(dev);
                // Surface each hit progressively while the sweep continues.
                setDiscoveredDevices((prev) => {
                  const exists = prev.some((d) => d.ip === dev.ip);
                  return exists ? prev : [...prev, dev];
                });
              }
            }
          })
          .catch(() => {
            clearTimeout(timeoutId);
          });
      });
      await Promise.all(promises);
    };

    // Sequential per subnet keeps the request burst bounded and shows results
    // from the most likely subnet first.
    for (const base of await candidateSubnets()) {
      await sweep(base);
    }

    setIsScanning(false);
    return found;
  }, []);

  return { isScanning, discoveredDevices, scanSubnet };
}
