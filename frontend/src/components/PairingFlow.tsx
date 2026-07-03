import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle,
  Laptop,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useDiscovery, type DiscoveredDevice } from '../hooks/useDiscovery';
import { db } from '../db/clientDb';

function generateUUID(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface PairingFlowProps {
  onClose: () => void;
  onSuccess: () => void;
  /** Called with the newly paired device UUID so the host can make it active. */
  onPaired?: (uuid: string) => void;
}

export default function PairingFlow({ onClose, onSuccess, onPaired }: PairingFlowProps) {
  const { isScanning, discoveredDevices, scanSubnet } = useDiscovery();
  const [manualIp, setManualIp] = useState('');
  const [pin, setPin] = useState('');
  const [pairingDevice, setPairingDevice] = useState<DiscoveredDevice | null>(null);
  const [sessionToken, setSessionToken] = useState('');
  const [clientUuid, setClientUuid] = useState('');
  const [step, setStep] = useState<'select' | 'pin' | 'success' | 'error'>('select');
  const [errorMessage, setErrorMessage] = useState('');
  const [manualError, setManualError] = useState('');
  const [pinError, setPinError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const getBaseUrl = (ipOrUrl: string) => {
    const trimmed = ipOrUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `http://${trimmed}:23810`;
  };

  const initiatePairing = async (device: DiscoveredDevice) => {
    setPairingDevice(device);
    setIsChecking(true);
    try {
      setErrorMessage('');
      const newClientUuid = generateUUID();
      setClientUuid(newClientUuid);
      const targetUrl = getBaseUrl(device.ip);
      const response = await fetch(`${targetUrl}/api/v1/pair/initiate`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: newClientUuid,
          client_name: 'Orbit PWA',
          client_public_key: `ECDSA_PUB_KEY_${newClientUuid}`,
        }),
      });

      if (!response.ok) throw new Error('Failed to initiate pairing.');

      const data = await response.json();
      if (data.status === 'pending_pin') {
        setSessionToken(data.pairing_session_token);
        setStep('pin');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to connect to Orbit Agent.');
      setStep('error');
    } finally {
      setIsChecking(false);
    }
  };

  const handleManualAdd = async () => {
    const ip = manualIp.trim();
    if (!ip || isChecking) return;
    setManualError('');
    setIsChecking(true);
    try {
      const targetUrl = getBaseUrl(ip);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${targetUrl}/api/v1/ping`, {
        mode: 'cors',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (data.status !== 'online') throw new Error('offline');

      await initiatePairing({
        ip: targetUrl,
        port: 23810,
        name: data.agent_name,
        os: data.os,
        version: data.version,
        paired: data.paired,
      });
    } catch {
      // Stay on this step — the user most likely just mistyped the IP.
      setManualError(`Can't reach ${ip}. Check the address and make sure Orbit Agent is running on that PC.`);
    } finally {
      setIsChecking(false);
    }
  };

  const verifyPin = async (pinValue?: string) => {
    const code = (pinValue ?? pin).trim();
    if (!pairingDevice || code.length < 6 || isVerifying) return;
    setIsVerifying(true);
    try {
      setErrorMessage('');
      const targetUrl = getBaseUrl(pairingDevice.ip);
      const response = await fetch(`${targetUrl}/api/v1/pair/verify`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_session_token: sessionToken,
          pin: code,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => null);
        const detail: string = err?.detail || 'Invalid pairing PIN code.';
        // A wrong PIN keeps the pairing session alive on the agent (it allows
        // several attempts) — stay on this step and let the user retype
        // instead of bouncing them to a dead-end error screen.
        if (response.status === 400 && /invalid/i.test(detail)) {
          setPin('');
          setPinError('Wrong code — check the number on the PC screen and try again.');
          return;
        }
        throw new Error(detail);
      }
      setPinError('');

      const data = await response.json();
      if (data.status === 'paired') {
        const mac = data.mac_address || '00:00:00:00:00:00';

        // Re-pairing the same physical PC (same MAC, or same address when the
        // MAC is unknown) must update its entry, not add a duplicate — pairing
        // via localhost, 127.0.0.1 and the LAN IP is still one computer.
        // (macAddress is not a Dexie index — filter() instead of where().)
        const existing =
          (mac !== '00:00:00:00:00:00'
            ? await db.devices.filter((d) => d.macAddress === mac).first()
            : undefined) || (await db.devices.where('ipAddress').equals(targetUrl).first());

        if (existing) {
          await db.devices.update(existing.id!, {
            uuid: clientUuid, // the agent registered this pairing under the new id
            name: pairingDevice.name,
            ipAddress: targetUrl,
            port: pairingDevice.port,
            macAddress: mac,
            osName: pairingDevice.os,
            osVersion: pairingDevice.version,
            sharedSecret: data.encrypted_shared_secret,
            isPaired: true,
            lastConnected: new Date(),
          });
        } else {
          await db.devices.add({
            uuid: clientUuid,
            name: pairingDevice.name,
            ipAddress: targetUrl,
            port: pairingDevice.port,
            macAddress: mac,
            osName: pairingDevice.os,
            osVersion: pairingDevice.version,
            sharedSecret: data.encrypted_shared_secret,
            isPaired: true,
            lastConnected: new Date(),
          });
        }

        // Make the newly paired device the active one immediately.
        onPaired?.(clientUuid);

        setStep('success');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error verifying PIN code.');
      setStep('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const title = {
    select: 'Add PC',
    pin: 'Enter PIN',
    success: 'Paired',
    error: 'Pairing Error',
  }[step];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-4 backdrop-blur-xl">
      <motion.div
        className="glass-card w-full max-w-[390px] overflow-hidden rounded-[32px] p-5"
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 18 }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-black leading-tight text-[#17181c]">{title}</h2>
            <p className="text-xs font-bold text-[#7b8491]">Connect Orbit to your computer</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-[#6e7682] shadow-sm"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {step === 'select' && (
            <motion.div
              key="select"
              className="flex flex-col gap-4"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input
                    value={manualIp}
                    onChange={(event) => {
                      setManualIp(event.target.value);
                      if (manualError) setManualError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleManualAdd();
                    }}
                    inputMode="decimal"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="192.168.1.100"
                    className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm font-bold text-[#17181c] outline-none placeholder:text-[#9aa3b0] focus:border-[#007aff]"
                  />
                  <button
                    type="button"
                    onClick={handleManualAdd}
                    disabled={isChecking}
                    className="grid h-12 w-12 place-items-center rounded-2xl bg-[#007aff] text-white shadow-lg shadow-blue-500/20 disabled:opacity-60"
                    aria-label="Add manually"
                  >
                    {isChecking ? <Loader2 size={19} className="spin" /> : <Plus size={19} />}
                  </button>
                </div>
                {manualError && (
                  <p className="m-0 px-1 text-xs font-bold text-[#c22b22]">{manualError}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#7b8491]">Local Network</span>
                <button
                  type="button"
                  onClick={() => scanSubnet()}
                  disabled={isScanning}
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-[#007aff]"
                  aria-label="Scan network"
                >
                  <RefreshCw size={16} className={isScanning ? 'spin' : ''} />
                </button>
              </div>

              <div className="max-h-[230px] overflow-y-auto rounded-[24px] bg-white/45 p-2">
                {discoveredDevices.length === 0 ? (
                  <div className="grid min-h-[150px] place-items-center content-center gap-2 text-center text-xs font-bold text-[#8b94a1]">
                    <Search size={24} />
                    <span>Start scanning or enter IP address manually.</span>
                  </div>
                ) : (
                  discoveredDevices.map((device) => (
                    <button
                      key={`${device.ip}-${device.name}`}
                      type="button"
                      onClick={() => initiatePairing(device)}
                      disabled={isChecking}
                      className="flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition hover:bg-white/60 disabled:opacity-60"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#007aff] text-white">
                        <Laptop size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-black text-[#17181c]">{device.name}</strong>
                        <small className="block truncate text-xs font-bold text-[#7b8491]">{device.ip}</small>
                      </span>
                      <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black text-[#007aff]">
                        {isChecking && pairingDevice?.ip === device.ip ? <Loader2 size={14} className="spin" /> : 'Pair'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {step === 'pin' && (
            <motion.div key="pin" className="grid gap-5 py-3 text-center" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
              <p className="mx-auto max-w-[270px] text-sm font-bold text-[#7b8491]">
                Enter the 6-digit pairing code displayed on the computer screen ({pairingDevice?.name || 'your PC'}).
              </p>
              <input
                value={pin}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                onChange={(event) => {
                  const next = event.target.value.replace(/\D/g, '');
                  setPin(next);
                  // All six digits typed — no need to make the user find Confirm.
                  if (next.length === 6) verifyPin(next);
                }}
                placeholder="000000"
                className={`mx-auto w-52 border-0 border-b-2 bg-transparent py-2 text-center text-3xl font-black tracking-[8px] text-[#17181c] outline-none ${pinError ? 'border-[#ff3b30]' : 'border-[#007aff]'}`}
              />
              {pinError && <p className="m-0 text-xs font-bold text-[#c22b22]">{pinError}</p>}
              <button
                type="button"
                onClick={() => verifyPin()}
                disabled={isVerifying}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#007aff] py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 disabled:opacity-60"
              >
                {isVerifying && <Loader2 size={16} className="spin" />}
                {isVerifying ? 'Pairing…' : 'Confirm'}
              </button>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" className="grid place-items-center gap-4 py-8 text-center" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
              <CheckCircle size={52} className="text-[#34c759]" />
              <p className="text-sm font-black text-[#17181c]">Computer paired successfully and ready to control.</p>
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="rounded-2xl bg-[#17181c] px-7 py-3 text-sm font-black text-white"
              >
                Done
              </button>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div key="error" className="grid place-items-center gap-4 py-6 text-center" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}>
              <ShieldAlert size={46} className="text-[#ff3b30]" />
              <p className="max-w-[280px] text-sm font-bold text-[#c22b22]">{errorMessage}</p>
              <button type="button" onClick={() => setStep('select')} className="rounded-2xl bg-white/70 px-7 py-3 text-sm font-black text-[#17181c]">
                Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
