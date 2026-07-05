import { getQuickActionMeta } from './quickActions';
import { useOrbit } from '../../../state/OrbitContext';
import type { WidgetInstance } from './types';

interface CircleShortcutWidgetProps {
  instance: WidgetInstance;
}

export function CircleShortcutWidget({ instance }: CircleShortcutWidgetProps) {
  const { sendEvent, postSystemAction } = useOrbit();
  const actionKey = (instance.config?.action as string) || 'lock';
  const meta = getQuickActionMeta(actionKey);

  if (!meta) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[10px] text-[#8c94a0] font-bold">
        Choose action in settings
      </div>
    );
  }

  const run = () => {
    if (meta.confirm && !confirm(meta.confirm)) return;
    if (meta.combo) return sendEvent({ event: 'key_combo', keys: meta.combo });
    if (meta.endpoint) postSystemAction(meta.endpoint);
  };

  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={run}
      className="flex flex-col items-center justify-center gap-1.5 w-full h-full border-none bg-transparent active:scale-95 transition-transform"
    >
      <div className={`cc-circle-btn ${meta.red ? 'red' : 'dark'}`}>
        <Icon size={20} />
      </div>
      <span className="text-[10px] font-black text-var-ink truncate max-w-[80px]">
        {meta.label}
      </span>
    </button>
  );
}
