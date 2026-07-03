import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';

import { useLiveQuery } from 'dexie-react-hooks';

import { OrbitProvider, useOrbit } from './state/OrbitContext';
import { db } from './db/clientDb';
import { useScrollFade } from './hooks/useScrollFade';
import { Navbar } from './components/Navbar';
import { AudioPlayer } from './components/AudioPlayer';
import { Onboarding, ONBOARDING_SEEN_KEY } from './components/Onboarding';
import { InstallPrompt } from './components/InstallPrompt';
import PairingFlow from './components/PairingFlow';
import { DashboardTab } from './features/dashboard/DashboardTab';
import { MouseTab } from './features/mouse/MouseTab';
import { StreamTab } from './features/stream/StreamTab';
import { FilesTab } from './features/files/FilesTab';
import { SettingsSheet } from './features/settings/SettingsSheet';
import { ToolSheets, type ToolId } from './features/settings/ToolSheets';
import type { View } from './types';

interface ShellProps {
  showPairing: boolean;
  setShowPairing: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  activeTool: ToolId | null;
  setActiveTool: (t: ToolId | null) => void;
}

function AppShell({
  showPairing,
  setShowPairing,
  showSettings,
  setShowSettings,
  activeTool,
  setActiveTool,
}: ShellProps) {
  const { devices, devicesLoaded, setActiveDeviceUuid } = useOrbit();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const { ref: stageRef, hasMore: hasMoreBelow } = useScrollFade<HTMLElement>();

  // undefined = still reading, null = never seen, 'true' = seen. Resolving
  // this OUTSIDE the Onboarding component keeps its mount/unmount decision
  // synchronous — see the ghost-overlay note in Onboarding.tsx.
  const onboardingSeen = useLiveQuery(
    async () => (await db.settings.get(ONBOARDING_SEEN_KEY))?.value ?? null,
    []
  );
  const showOnboarding =
    devicesLoaded && devices.length === 0 && !showPairing && onboardingSeen === null;

  return (
    <div className="app-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-green" />

      <main className="phone-frame">
        <section
          ref={stageRef}
          className={`content-stage ${activeView === 'mouse' ? 'no-scroll' : ''} ${hasMoreBelow ? 'has-more-below' : ''}`}
        >
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && <DashboardTab onNavigate={setActiveView} />}
            {activeView === 'mouse' && <MouseTab />}
            {activeView === 'stream' && <StreamTab />}
            {activeView === 'files' && <FilesTab />}
          </AnimatePresence>
        </section>

        <Navbar activeView={activeView} setActiveView={setActiveView} />
      </main>

      {/* Mounted only pre-pairing so a returning user never risks a flash. */}
      <AnimatePresence>
        {showOnboarding && <Onboarding onScanQr={() => setShowPairing(true)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showPairing && (
          <PairingFlow
            onClose={() => setShowPairing(false)}
            onSuccess={() => setShowPairing(false)}
            onPaired={(uuid) => {
              setActiveDeviceUuid(uuid);
              setShowPairing(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsSheet
            onClose={() => setShowSettings(false)}
            onOpenPairing={() => {
              setShowSettings(false);
              setShowPairing(true);
            }}
            onOpenTool={(tool) => {
              setShowSettings(false);
              setActiveTool(tool);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeTool && <ToolSheets tool={activeTool} onClose={() => setActiveTool(null)} />}
      </AnimatePresence>

      {/* Nudge installation only once the user actually has a paired PC —
          never on top of onboarding/pairing, and pairing first matters more. */}
      <InstallPrompt enabled={devicesLoaded && devices.length > 0} />

      <AudioPlayer />
    </div>
  );
}

export default function App() {
  const [showPairing, setShowPairing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);

  return (
    <OrbitProvider
      onOpenPairing={() => setShowPairing(true)}
      onOpenSettings={() => setShowSettings(true)}
    >
      <AppShell
        showPairing={showPairing}
        setShowPairing={setShowPairing}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
      />
    </OrbitProvider>
  );
}
