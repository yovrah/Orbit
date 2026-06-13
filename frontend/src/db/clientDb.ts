import Dexie, { type Table } from 'dexie';

export interface Device {
  id?: number;
  uuid: string;
  name: string;
  ipAddress: string;
  port: number;
  macAddress: string;
  osName: string;
  osVersion: string;
  sharedSecret: string; // HMAC signing key
  isPaired: boolean;
  lastConnected: Date;
}

export interface Shortcut {
  id?: number;
  deviceUuid: string;
  title: string;
  command: string;
  iconType: string;
  colorHex: string;
}

export interface Setting {
  key: string;
  value: any;
}

class OrbitDatabase extends Dexie {
  devices!: Table<Device>;
  shortcuts!: Table<Shortcut>;
  settings!: Table<Setting>;

  constructor() {
    super('OrbitDatabase');
    this.version(1).stores({
      devices: '++id, uuid, name, ipAddress, lastConnected',
      shortcuts: '++id, deviceUuid, title',
      settings: 'key'
    });
  }
}

export const db = new OrbitDatabase();
