/**
 * Typing Indicator for ChatPanel
 * Shows animated dots while AI is "thinking"
 */

import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl shadow-lg shadow-slate-500/5 w-fit">
      <div className="flex items-center gap-1">
        <motion.div
          className="w-2 h-2 bg-purple-600 rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0
          }}
        />
        <motion.div
          className="w-2 h-2 bg-blue-600 rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.2
          }}
        />
        <motion.div
          className="w-2 h-2 bg-emerald-600 rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 0.4
          }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 ml-1">AI is thinking...</span>
    </div>
  );
}
