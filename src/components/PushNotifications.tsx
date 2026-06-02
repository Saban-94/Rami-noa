import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Bell, X, CheckCircle } from 'lucide-react';

interface PushNotificationProps {
  notification: {
    id: string;
    title: string;
    body: string;
    appName: string;
    icon?: React.ReactNode;
  } | null;
  onClose: () => void;
}

export default function PushNotification({ notification, onClose }: PushNotificationProps) {
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 5500); // Auto-dismiss after 5.5 seconds
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  return (
    <div className="fixed top-4 left-4 right-4 z-50 flex justify-center pointer-events-none">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            className="w-full max-w-sm pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-4 relative"
            style={{ direction: 'rtl' }}
          >
            <div className="flex gap-3">
              {/* App Icon Container */}
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                {notification.icon || <Bell className="w-5 h-5" />}
              </div>

              {/* Notification Context */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 tracking-wider">
                    {notification.appName || 'נועה'}
                  </span>
                  <span className="text-[10px] text-slate-400">עכשיו</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-800 mt-0.5 leading-snug">
                  {notification.title}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-normal">
                  {notification.body}
                </p>
              </div>

              {/* Dismiss Button */}
              <button 
                onClick={onClose}
                className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                id="btn-dismiss-notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated Apple/Android Pill Notch Decorator */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-slate-200" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
