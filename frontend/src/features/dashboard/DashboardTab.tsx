import { useState } from 'react';
import { motion } from 'framer-motion';
import { Monitor, Power, Pencil, Check, Plus } from 'lucide-react';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ConnectBanner } from '../../components/ConnectBanner';
import { useOrbit } from '../../state/OrbitContext';
import { useHomeLayout } from './widgets/useHomeLayout';
import { useOsCardVisibility } from './useOsCardVisibility';
import { HomeGrid } from './widgets/HomeGrid';
import { AddWidgetSheet } from './widgets/AddWidgetSheet';
import { QuickActionsConfigSheet } from './widgets/QuickActionsConfigSheet';
import { CircleShortcutConfigSheet } from './widgets/CircleShortcutConfigSheet';
import { WakeOnLanSheet } from './WakeOnLanSheet';
import { OsHeroCard } from './OsHeroCard';
import type { View } from '../../types';

const spring = { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 } as const;

interface DashboardTabProps {
  onNavigate: (view: View) => void;
}

export function DashboardTab({ onNavigate }: DashboardTabProps) {
  const { activeDevice, postSystemAction } = useOrbit();
  const { widgets, reorder, reorderPreview, addWidget, removeWidget, resizeWidget, updateWidgetConfig } =
    useHomeLayout();
  const osCard = useOsCardVisibility();

  const [editing, setEditing] = useState(false);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showWakeSheet, setShowWakeSheet] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);

  const configuringWidget = widgets.find((w) => w.id === configuringId) ?? null;

  const deviceName = activeDevice?.name?.trim() || 'My PC';

  const confirmShutdown = () => confirm('Shut down the PC?') && postSystemAction('/api/v1/system/shutdown');

  return (
    <motion.div
      key="dashboard"
      className="screen"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
    >
      <header className="cc-header">
        <div className="cc-header-left">
          {editing ? (
            <button
              type="button"
              className="cc-head-btn cc-btn-plus"
              onClick={() => setShowAddWidget(true)}
              aria-label="Add widget"
            >
              <Plus size={22} strokeWidth={2.5} />
            </button>
          ) : (
            <button
              type="button"
              className="cc-head-btn"
              onClick={() => setEditing(true)}
              aria-label="Edit widgets"
            >
              <Pencil size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="cc-header-center">
          <div className="cc-status-pill">
            <span className={`cc-dot ${activeDevice ? 'online' : 'offline'}`} />
            <span className="cc-device-name">{deviceName}</span>
          </div>
        </div>

        <div className="cc-header-right">
          {editing ? (
            <button
              type="button"
              className="cc-head-btn cc-btn-done"
              onClick={() => setEditing(false)}
              aria-label="Done editing"
            >
              <Check size={19} strokeWidth={3} />
            </button>
          ) : (
            <button
              type="button"
              className="cc-head-btn cc-btn-power"
              onClick={confirmShutdown}
              aria-label="Power off"
            >
              <Power size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </header>

      <ConnectBanner />

      <OsHeroCard
        editing={editing}
        visible={osCard.visible}
        onRemove={osCard.hide}
        onRestore={osCard.show}
        onNavigate={() => onNavigate('stream')}
      />

      <HomeGrid
        widgets={widgets}
        editing={editing}
        onReorder={reorder}
        onReorderPreview={reorderPreview}
        onRemove={removeWidget}
        onResize={resizeWidget}
        onConfigure={setConfiguringId}
        onNavigateStream={() => onNavigate('stream')}
        onNavigateTransfer={() => onNavigate('files')}
        onNavigateMouse={() => onNavigate('mouse')}
        onPowerOn={() => setShowWakeSheet(true)}
      />

      {showAddWidget && (
        <AddWidgetSheet
          existingTypes={widgets.map((w) => w.type)}
          onAdd={addWidget}
          onClose={() => setShowAddWidget(false)}
        />
      )}

      {showWakeSheet && <WakeOnLanSheet onClose={() => setShowWakeSheet(false)} />}

      {configuringWidget && (
        configuringWidget.type === 'circleShortcut' ? (
          <CircleShortcutConfigSheet
            instance={configuringWidget}
            onChange={(action) => updateWidgetConfig(configuringWidget.id, { action })}
            onClose={() => setConfiguringId(null)}
          />
        ) : (
          <QuickActionsConfigSheet
            instance={configuringWidget}
            onChange={(actions) => updateWidgetConfig(configuringWidget.id, { actions })}
            onClose={() => setConfiguringId(null)}
          />
        )
      )}
    </motion.div>
  );
}
