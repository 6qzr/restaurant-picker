import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { springSet } from '../../motion/springs.js';

/** A sheet that grows from the bottom and dismisses the same way.
 *
 *  Enter and exit follow the same path -- something that slid up and then faded
 *  out sideways reads as two unrelated objects. Blur and scale animate together
 *  so the surface arrives as a material rather than as an opacity ramp. */
export const Sheet = ({ open, onClose, title, children, reduced }) => {
    const S = springSet(reduced);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 z-40"
                        initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        animate={{ opacity: 1, backdropFilter: reduced ? 'blur(0px)' : 'blur(14px)' }}
                        exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
                        transition={S.ui}
                        style={{ background: 'rgba(0,0,0,0.28)' }}
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto"
                        initial={{ y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1, scale: reduced ? 1 : 0.98 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1, scale: reduced ? 1 : 0.98 }}
                        transition={S.sheet}
                    >
                        <div
                            className="mx-auto max-w-lg rounded-t-3xl p-5"
                            style={{
                                background: 'var(--surface)',
                                borderTop: '1px solid var(--line)',
                                paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
                            }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="display">{title}</h2>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="btn grid place-items-center w-9 h-9"
                                    style={{ color: 'var(--ink-3)' }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default Sheet;
