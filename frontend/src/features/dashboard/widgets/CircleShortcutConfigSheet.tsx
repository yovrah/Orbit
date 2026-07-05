import { motion } from 'framer-motion';
import { X, ChevronRight } from 'lucide-react';
import { Portal } from '../../../components/Portal';
import { QUICK_ACTION_CATALOG } from './quickActions';
import type { QuickActionKey } from './quickActions';
import type { WidgetInstance } from './types';

interface CircleShortcutConfigSheetProps {
  instance: WidgetInstance;
  onChange: (action: QuickActionKey) => void;
  onClose: () => void;
}

export function CircleShortcutConfigSheet({ instance, onChange, onClose }: CircleShortcutConfigSheetProps) {
  const currentAction = (instance.config?.action as QuickActionKey) || 'lock';

  const select = (key: QuickActionKey) => {
    onChange(key);
    onClose();
  };

  return (
    <Portal>
      <motion.div
        className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-md flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-[430px] rounded-t-[32px] p-5 pb-0 flex flex-col gap-3 bg-[var(--phone-bg)] border border-black/5"
          style={{ maxHeight: 'min(72dvh, calc(100dvh - 140px))' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 360, damping: 36 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center" style={{ flexShrink: 0 }}>
            <div>
              <h2 className="m-0 text-xl font-black text-var-ink">Choose Action</h2>
              <span className="text-xs text-[#8c94a0] font-bold">Pick which system action this circle button fires</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#6e7682]"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="sheet-scroll-body" style={{ paddingBottom: 20 }}>
            <div className="set-group">
              {QUICK_ACTION_CATALOG.map((meta) => {
                const Icon = meta.icon;
                const isSelected = currentAction === meta.key;
                return (
                  <button
                    key={meta.key}
                    type="button"
                    className={`set-row ${isSelected ? 'selected-item' : ''}`}
                    onClick={() => select(meta.key)}
                  >
                    <span className="r-ico">
                      <Icon size={16} />
                    </span>
                    <span className="r-name font-bold">{meta.label}</span>
                    {isSelected ? (
                      <span className="text-[11px] font-black text-var-blue uppercase tracking-wider mr-2">Selected</span>
                    ) : (
                      <ChevronRight size={16} className="text-[#9aa3b0]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </Portal>
  );
}
