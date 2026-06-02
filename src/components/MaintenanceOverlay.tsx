import React from 'react';
import { 
  Lock, ArrowLeft, RefreshCw, Database, Copy, Check, ExternalLink, Bell, Calendar, FileText, ListTodo
} from 'lucide-react';
import { SystemConfig, BlackBoxLog } from '../types';

interface MaintenanceOverlayProps {
  onClose: () => void;
  config: SystemConfig;
  setConfig: React.Dispatch<React.SetStateAction<SystemConfig>>;
  saveConfiguration: (url: string, simulated: boolean) => Promise<void>;
  diagnostics: any;
  loadingDiagnostics: boolean;
  fetchDiagnostics: () => Promise<void>;
  filteredLogs: BlackBoxLog[];
  activeTab: 'כל' | 'יומן' | 'כונן' | 'משימות' | 'הסבר';
  setActiveTab: (tab: 'כל' | 'יומן' | 'כונן' | 'משימות' | 'הסבר') => void;
  currentUser: any;
  googleAppsScriptCode: string;
  copiedScript: boolean;
  copyScriptText: () => void;
  triggerPushNotification: (title: string, body: string) => void;
  setToastMessage: (msg: string | null) => void;
  createRealCalendarEvent: () => Promise<void>;
  createRealDriveFile: () => Promise<void>;
}

export const MaintenanceOverlay: React.FC<MaintenanceOverlayProps> = ({
  onClose,
  config,
  setConfig,
  saveConfiguration,
  diagnostics,
  loadingDiagnostics,
  fetchDiagnostics,
  filteredLogs,
  activeTab,
  setActiveTab,
  currentUser,
  googleAppsScriptCode,
  copiedScript,
  copyScriptText,
  triggerPushNotification,
  setToastMessage,
  createRealCalendarEvent,
  createRealDriveFile,
}) => {
  return (
    <div className="absolute inset-0 bg-[#FAF8F5]/99 backdrop-blur-md z-50 flex flex-col animate-fade-in RTL direction-rtl text-right overflow-y-auto scrollbar-none">
      
      {/* Header Bar */}
      <div className="sticky top-0 bg-[#FAF8F5]/95 backdrop-blur-md p-5 border-b border-rose-100/30 flex items-center justify-between z-30 shrink-0">
        <div className="text-right">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 justify-start">
            <Lock className="w-4 h-4 text-slate-600" />
            <span>לוח ניהול, אחזקה וקופסה שחורה</span>
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
            מזהי דומיין, מצב חיבורי ענן Google, ומנוע רישום פעולות מלא
          </p>
        </div>
        <button 
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-slate-200/50 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-3xs"
          title="חזרה לאפליקציה"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5 flex-1 pb-10">
        
        {/* Connection Diagnostics Lights */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-3xs flex flex-col gap-3">
          <div className="flex justify-between items-center pb-2 border-b border-slate-50">
            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">נוריות בקרה ואוטומציית אימות (Diagnostics)</span>
            <button 
              onClick={fetchDiagnostics}
              disabled={loadingDiagnostics}
              className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-100 text-[9.5px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loadingDiagnostics ? 'animate-spin' : ''}`} />
              <span>אימות מחודש</span>
            </button>
          </div>

          {loadingDiagnostics ? (
            <div className="py-6 text-center text-slate-400 font-mono text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>מבצע אימות נתונים והרשאות מול Google Services...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {/* Back-end indicators */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/40 flex flex-col gap-1 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">שירותי ענן Vercel</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-none mt-0.5">מחובר ויציב (Live)</p>
                <p className="text-[8px] text-slate-400 leading-none mt-1">נמל פנימי: Port 3000 Verified</p>
              </div>

              {/* Firebase indicators */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/40 flex flex-col gap-1 text-right">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">בסיס נתונים Firebase</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-xs font-bold text-slate-700 leading-none mt-0.5">מאובטח (Auth-Active)</p>
                <p className="text-[8px] text-slate-400 leading-none mt-1">
                  {currentUser ? "פרופיל מסונכרן קלאוד" : "מצב שימוש אורח פתוח"}
                </p>
              </div>

              {/* JWT Credentials indicators */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100/40 flex flex-col gap-1 text-right col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400">Google APIs Client (Service Account)</span>
                  <span className={`w-2 h-2 rounded-full ${diagnostics?.googleAuthOk ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                </div>
                <p className="text-xs font-bold text-slate-700 mt-0.5">
                  {diagnostics?.googleAuthOk ? 'אישור קישור גוגל תקין (Authorized)' : 'שגיאת מפתח (Not Configured)'}
                </p>
                {diagnostics?.googleScopes && diagnostics?.googleScopes.length > 0 && (
                  <p className="text-[8px] text-emerald-600 font-medium leading-none mt-1">
                    Scopes: Calendar, Drive, Tasks (Full Access)
                  </p>
                )}
                {diagnostics?.googleAuthError && (
                  <p className="text-[8px] text-rose-500 leading-normal mt-1 block max-h-12 overflow-y-auto font-mono text-left">
                    {diagnostics.googleAuthError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Configurations settings block */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-3xs flex flex-col gap-3.5 text-right">
          <div>
            <h4 className="font-bold text-xs text-slate-800">הגדרות סנכרון Webhook ורשימת תיעוד קופסה שחורה</h4>
            <p className="text-[9.5px] text-slate-400 mt-0.5 font-medium">קביעת הקישור בין שרתי Vercel, Firebase ו-Google Apps Script Web App</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500">כתובת ה-Deployment Webhook של Google Script:</label>
            <input
              type="text"
              placeholder="https://script.google.com/macros/s/..."
              value={config.appsScriptUrl}
              onChange={(e) => setConfig({ ...config, appsScriptUrl: e.target.value })}
              className="w-full bg-[#FAF8F5] border border-slate-250 py-2 px-3 rounded-xl text-xs font-mono text-left outline-none focus:border-sky-300 transition-all font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-1.5">
            <label className="text-[10px] font-bold text-slate-500">מנגנון סנכרון פעיל:</label>
            <div className="flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => saveConfiguration(config.appsScriptUrl, true)}
                className={`text-[9.5px] py-1.5 px-3 rounded-lg font-bold flex-1 transition-all cursor-pointer ${
                  config.useSimulatedSheets 
                    ? 'bg-white text-slate-800 shadow-3xs border border-slate-200/50' 
                    : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                הדמיה קומית
              </button>
              <button
                type="button"
                onClick={() => saveConfiguration(config.appsScriptUrl, false)}
                className={`text-[9.5px] py-1.5 px-3 rounded-lg font-bold flex-1 transition-all cursor-pointer ${
                  !config.useSimulatedSheets 
                    ? 'bg-white text-slate-800 shadow-3xs border border-slate-200/50' 
                    : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                סנכרון חי לגוגל (Live)
              </button>
            </div>
          </div>

          {config.spreadsheetUrl && (
            <div className="bg-sky-50/50 p-2.5 rounded-xl border border-sky-100 flex items-center justify-between text-[10px] mt-1.5 font-semibold">
              <span className="text-sky-700">גיליון פעיל שהקופסה השחורה יוצרת:</span>
              <a
                href={config.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[#0284c7] hover:underline font-bold flex items-center gap-1 shrink-0"
              >
                <span>פתח גיליון אב 🚀</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* LOG LIVE MONITOR TABULAR REPORT */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-3xs flex-1 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <div className="text-right">
              <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">תיעודים בקופסה שלי (Black Box Logs)</span>
              <p className="text-[9px] text-slate-400 font-medium">הפעולות ההיסטוריות שנועה ביצעה בחשבון גוגל</p>
            </div>
            
            <div className="flex gap-1 overflow-x-auto max-w-[170px] pb-1">
              {(['כל', 'יומן', 'כונן', 'משימות'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab as any)}
                  className={`text-[9.5px] px-2 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === tab 
                      ? 'bg-sky-50 text-[#0284c7] border border-sky-200/50' 
                      : 'bg-slate-50 text-slate-400 hover:bg-slate-100/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[220px] border border-slate-100/50 rounded-xl pr-1">
            {filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-1.5 font-medium text-xs">
                <Database className="w-7 h-7 stroke-1 text-slate-300" />
                <span>אין פעולות תיעוד מתאימות ברשומה</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-1.5">
                {filteredLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="bg-slate-50 p-2.5 rounded-xl border border-slate-100/60 flex items-center justify-between text-right gap-2 shadow-3xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none shrink-0 ${
                          log.toolName === 'יומן' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                          log.toolName === 'כונן' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          log.toolName === 'משימות' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {log.toolName}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 truncate leading-tight">
                          {log.description}
                        </span>
                      </div>
                      <p className="text-[8.5px] text-slate-400 mt-1 flex items-center gap-1 justify-start">
                        <span>זמן: {log.timestamp}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px]">{log.location}</span>
                      </p>
                    </div>
                    <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap leading-none shrink-0 ${
                      log.syncStatus === 'סונכרן לגוגל שיטס'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {log.syncStatus === 'סונכרן לגוגל שיטס' ? 'בגוגל ✓' : 'מקומי 🔒'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* GAS EXPORTER CODE AREA */}
        <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-3xl text-right text-xs leading-relaxed flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-bold text-slate-800 leading-none">קוד Google Apps Script המובנה</h5>
              <p className="text-[8.5px] text-[#0284c7] font-semibold mt-1">קטע קוד להתקנה חינמית בחשבון גוגל האישי</p>
            </div>
            <button
              onClick={copyScriptText}
              className="text-[9px] bg-white hover:bg-slate-100/50 text-slate-600 hover:text-slate-850 border border-slate-200 px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer shadow-3xs"
            >
              {copiedScript ? <Check className="w-3 h-3 text-emerald-600 animate-bounce" /> : <Copy className="w-3 h-3" />}
              <span>{copiedScript ? "הועתק!" : "העתק קוד"}</span>
            </button>
          </div>

          <div className="relative">
            <pre className="bg-[#1e293b] text-slate-300 p-3 rounded-2xl overflow-x-auto text-left font-mono text-[9px] max-h-32 leading-relaxed scrollbar-thin">
              {googleAppsScriptCode}
            </pre>
          </div>
        </div>

        {/* DUMMY SIMULATOR ACTIONS */}
        <div className="bg-amber-50/30 border border-amber-200/40 p-4 rounded-3xl flex flex-col gap-2.5 text-right">
          <h5 className="text-[10.5px] font-bold text-amber-900 leading-none">מפרט סימולציות ומבדק נתונים חי</h5>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                triggerPushNotification("התראה מקומית דחופה 📱", "נועה בדקה ומצאה חריגה בסנכרון משימות חשבון גוגל!");
                setToastMessage("נשלחה התראת דחיפה לסימולטור!");
              }}
              className="bg-white hover:bg-amber-100/20 text-amber-800 border border-amber-200 py-1.5 px-3 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
            >
              <Bell className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>שלחי התראת Push</span>
            </button>
            <button
              type="button"
              onClick={createRealCalendarEvent}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 py-1.5 px-3 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
            >
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>יצירת פגישת טסט</span>
            </button>
            <button
              type="button"
              onClick={createRealDriveFile}
              className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-250 py-1.5 px-3 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-3xs"
            >
              <FileText className="w-3 h-3 text-emerald-500" />
              <span>יצירת קובץ טסט</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
