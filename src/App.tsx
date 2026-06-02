import { useState, useEffect, useRef } from 'react';
import { 
  Send, Menu, MapPin, Bell, Database, Copy, Check, ExternalLink, 
  Calendar, FileText, ListTodo, X, Phone, Mail, Heart,
  Wifi, CheckCircle2, Info, User, RefreshCw, Lock
} from 'lucide-react';
import { googleAppsScriptCode } from './data/appsScriptCode';
import { Message, BlackBoxLog, ToolType, SystemConfig } from './types';
import { MaintenanceOverlay } from './components/MaintenanceOverlay';

// Firebase Integrations
import { doc, getDoc, setDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';

export default function App() {
  // Mobile UI States
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial_1",
      sender: "noa",
      text: "שלום! אני נועה, העוזרת האישית החכמה שלך. 🌿\nאני מחוברת ישירות לכלים שלך גוגל (Google Calendar, Drive & Tasks).\n\nבנוסף, כל פעולה קריטית שאני מבצעת מתועדת מיידית בקופסה השחורה המאובטחת שלך ב-Google Sheet.\nכיצד אוכל לסייע לך היום?",
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
      toolType: "כללי"
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNotificationToast, setShowNotificationToast] = useState<{title: string, body: string} | null>(null);
  const [pushNotifications, setPushNotifications] = useState<any[]>([]);

  // Authentication & Config states
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [envCheck, setEnvCheck] = useState<any>(null);
  const [loadingNoa, setLoadingNoa] = useState(false);

  const [config, setConfig] = useState<SystemConfig>({
    appsScriptUrl: "",
    useSimulatedSheets: true,
    spreadsheetUrl: ""
  });

  // Google APIs Data States (Fetched directly from backend without mocks)
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);

  const [googleTasks, setGoogleTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // New Google Tasks creation tool states (with Priority level field)
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [newTaskCategory, setNewTaskCategory] = useState<"Work" | "Personal" | "Shopping" | "Other">("Personal");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Hidden Maintenance Portal and Multi-Screen Smartphone states
  const [phoneScreen, setPhoneScreen] = useState<'chat' | 'calendar' | 'drive' | 'tasks'>('chat');
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);

  // Black Box logs status tab
  const [activeTab, setActiveTab] = useState<'כל' | 'יומן' | 'כונן' | 'משימות' | 'הסבר'>('כל');
  const [logs, setLogs] = useState<BlackBoxLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Fetch real Google Calendar Events
  const fetchCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        setCalendarEvents(data.events || []);
      }
    } catch (err) {
      console.error("Google Calendar fetch failed:", err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Fetch real Google Drive files
  const fetchDriveFiles = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetch("/api/drive");
      if (res.ok) {
        const data = await res.json();
        setDriveFiles(data.files || []);
      }
    } catch (err) {
      console.error("Google Drive fetch failed:", err);
    } finally {
      setLoadingDrive(false);
    }
  };

  // Fetch real Google Tasks
  const fetchGoogleTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setGoogleTasks(data.tasks || []);
      }
    } catch (err) {
      console.error("Google Tasks fetch failed:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Create real Google Task via Service Account
  const createRealGoogleTask = async (title: string, notes: string, priority: "High" | "Medium" | "Low", category: string) => {
    setLoadingLogs(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          priority,
          category,
          uid: currentUser?.uid || "guest"
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setToastMessage("המשימה נוספה בהצלחה לחשבון גוגל שלך! 📋");
          fetchGoogleTasks();

          // If signed in, also register locally in Firestore
          if (currentUser) {
            const logsLocRef = doc(collection(db, 'users', currentUser.uid, 'logs'));
            await setDoc(logsLocRef, {
              timestamp: new Date().toLocaleString('he-IL'),
              toolName: 'משימות',
              description: `יצירת משימה: "${title}" בעדיפות ${priority} (קטגוריה: ${category})`,
              location: getLocationString(),
              status: 'פעיל',
              syncStatus: config.useSimulatedSheets ? 'נשמר מקומית (קופסה שחורה)' : 'סונכרן לגוגל שיטס'
            });
          }
        }
      } else {
        const errData = await res.json();
        setToastMessage(`שגיאה ביצירת משימה: ${errData.error || 'נסה שוב'}`);
      }
    } catch (err) {
      console.error("Google task creation failed:", err);
      setToastMessage("שגיית תקשורת בעת הוספת משימה לשרת");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Effect to load real data when activeTab or phoneScreen changes
  useEffect(() => {
    if (phoneScreen === 'calendar') {
      fetchCalendar();
    }
    if (phoneScreen === 'drive') {
      fetchDriveFiles();
    }
    if (phoneScreen === 'tasks') {
      fetchGoogleTasks();
    }
  }, [phoneScreen]);


  // Geolocation States
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoMode, setGeoMode] = useState<'real' | 'simulated'>('simulated');
  const [simulatedCity, setSimulatedCity] = useState("תל אביב, ישראל");

  // Load physical sensor components or fallbacks on bootstrap
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setGeoMode('real');
        },
        () => {
          // Fallback to coordinates of Tel Aviv
          setCoords({ latitude: 32.0853, longitude: 34.7818 });
        }
      );
    } else {
      setCoords({ latitude: 32.0853, longitude: 34.7818 });
    }

    // Monitor Firebase Auth State
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      
      if (user) {
        // Authenticated user: Load user's private configuration from Cloud Firestore
        const userRef = doc(db, 'users', user.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            // Un-configured user profile, establish default document
            const defaultUserConfig = {
              email: user.email || '',
              appsScriptUrl: "https://script.google.com/macros/s/AKfycbycL710BrrgkCntQH6JyucaTjN5A0ep2t7R7iYh72VVxljvRyl9oXmVveGZ54ZV8gZ3eA/exec",
              useSimulatedSheets: false,
              spreadsheetUrl: ""
            };
            await setDoc(userRef, defaultUserConfig);
            setConfig(defaultUserConfig);
          } else {
            const data = userDoc.data();
            setConfig({
              email: data.email || user.email || '',
              appsScriptUrl: data.appsScriptUrl || '',
              useSimulatedSheets: !!data.useSimulatedSheets,
              spreadsheetUrl: data.spreadsheetUrl || ''
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        // Guest mode: load system defaults from API and Memory logs
        fetchEnvAndLogs();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync firestore logs sub-collection if user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    setLoadingLogs(true);
    const logsColRef = collection(db, 'users', currentUser.uid, 'logs');
    const logsQuery = query(logsColRef, orderBy('timestamp', 'desc'));

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const dbLogs: BlackBoxLog[] = [];
      snapshot.forEach((docSnapshot) => {
        const d = docSnapshot.data();
        dbLogs.push({
          id: docSnapshot.id,
          timestamp: d.timestamp || '',
          toolName: d.toolName || 'כללי',
          description: d.description || '',
          location: d.location || '',
          status: d.status || 'נרשם בהצלחה',
          syncStatus: d.syncStatus || 'נשמר מקומית (קופסה שחורה)'
        });
      });
      setLogs(dbLogs);
      setLoadingLogs(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}/logs`);
      setLoadingLogs(false);
    });

    return () => unsubscribeLogs();
  }, [currentUser]);

  // Set timeout to clear general toasts
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Set timeout to clear push notifications banner
  useEffect(() => {
    if (showNotificationToast) {
      const timer = setTimeout(() => setShowNotificationToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [showNotificationToast]);

  // Scroll chat to bottom with smoothness
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingNoa]);

  // Provide full real-time diagnostics of Server & Google API authorization checks
  const fetchDiagnostics = async () => {
    setLoadingDiagnostics(true);
    try {
      const res = await fetch("/api/diagnostics");
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      } else {
        setDiagnostics({
          success: false,
          serverStatus: "Error",
          googleAuthOk: false,
          googleAuthError: "Connection to diagnostic endpoint failed (HTTP Status != 200)"
        });
      }
    } catch (err: any) {
      setDiagnostics({
        success: false,
        serverStatus: "Offline",
        googleAuthOk: false,
        googleAuthError: err.message || String(err)
      });
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  // Fetch Environment setup status and sync logs
  const fetchEnvAndLogs = async () => {
    setLoadingLogs(true);
    try {
      // 1. Get Environmental check
      const res = await fetch("/api/env-check");
      if (res.ok) {
        const data = await res.json();
        setEnvCheck(data);
        if (data.config) {
          setConfig({
            appsScriptUrl: data.config.appsScriptUrl || '',
            useSimulatedSheets: !!data.config.useSimulatedSheets,
            spreadsheetUrl: data.config.spreadsheetUrl || config.spreadsheetUrl
          });
        }
        
        // 2. Fetch local blacklist logs
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Encountered boot sync failure:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Set Apps Script Url & Fallback toggle
  const saveConfiguration = async (appsScriptUrl: string, simulated: boolean) => {
    try {
      const payload = { appsScriptUrl, useSimulatedSheets: simulated };
      
      // If user is authenticated, save configuration persistent inside Firebase Firestore
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(userRef, payload, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      }

      // Sync backend memory
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setConfig({
            appsScriptUrl: data.config.appsScriptUrl,
            useSimulatedSheets: data.config.useSimulatedSheets,
            spreadsheetUrl: data.config.spreadsheetUrl || config.spreadsheetUrl
          });
          setToastMessage(simulated ? "המערכת עברה למצב הדמיה מקומי בהצלחה" : "כתובת ה-Apps Script עודכנה בהצלחה!");
          await fetchEnvAndLogs();
        }
      }
    } catch (err) {
      setToastMessage("שגיאה בשמירת התצורה");
    }
  };

  // Simulate Push Notification
  const triggerPushNotification = (title: string, body: string) => {
    const newNotif = {
      id: `notif_${Date.now()}`,
      title,
      body,
      time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    };
    setPushNotifications(prev => [newNotif, ...prev]);
    setShowNotificationToast({ title, body });
  };

  // Format Physical Location string
  const getLocationString = () => {
    if (geoMode === 'real' && coords) {
      return `מיקום מכשיר (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
    }
    return simulatedCity;
  };

  // Trigger Intent URLs or quick button triggers
  const handleButtonAction = async (btn: any) => {
    if (btn.type === 'link') {
      // Simulate real smartphone Intent opening
      triggerPushNotification("הפעלת אפליקציה חיצונית", `נועה פתחה קישור יעד: ${btn.payload}`);
      
      // Open the URL securely
      window.open(btn.payload, '_blank');
      setToastMessage(`מעביר אל: ${btn.text}`);
    } else if (btn.type === 'quick_reply') {
      sendMessage(btn.payload);
    } else if (btn.type === 'action') {
      if (btn.payload === 'LOCATION_SYNC') {
        setToastMessage("מעדכן מיקום נוכחי מול גוגל...");
      }
    }
  };

  // Send textual prompts directly to full-stack Server
  const sendMessage = async (overrideText?: string) => {
    const text = overrideText !== undefined ? overrideText : inputText;
    if (!text.trim()) return;

    setLoadingNoa(true);
    const timestamp = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `msg_${Date.now()}_u`;

    // 1. Push user prompt in feed
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp,
      location: coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    if (overrideText === undefined) {
      setInputText("");
    }

    try {
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          location: coords ? { latitude: coords.latitude, longitude: coords.longitude } : undefined,
          uid: currentUser?.uid || "guest"
        })
      });

      if (chatRes.ok) {
        const chatData = await chatRes.json();
        
        let toolType: ToolType = 'כללי';
        if (chatData.toolUsed === 'Calendar') toolType = 'יומן';
        else if (chatData.toolUsed === 'Drive') toolType = 'כונן';
        else if (chatData.toolUsed === 'Tasks') toolType = 'משימות';

        const noaReply: Message = {
          id: `msg_${Date.now()}_noa`,
          sender: 'noa',
          text: chatData.reply,
          timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
          toolType,
          buttons: chatData.buttons || []
        };

        setMessages(prev => [...prev, noaReply]);

        if (chatData.pushNotification) {
          triggerPushNotification(chatData.pushNotification.title, chatData.pushNotification.body);
        }

        // Auto reload real data if relevant tool was executed
        if (toolType === 'יומן') fetchCalendar();
        if (toolType === 'כונן') fetchDriveFiles();
        if (toolType === 'משימות') fetchGoogleTasks();

        // Sync local Firestore logs sub-collection if user is signed in
        if (currentUser && toolType !== 'כללי') {
          const logsLocRef = doc(collection(db, 'users', currentUser.uid, 'logs'));
          await setDoc(logsLocRef, {
            timestamp: new Date().toLocaleString('he-IL'),
            toolName: toolType,
            description: chatData.toolDescription || `ביצוע פעולת ${toolType}`,
            location: getLocationString(),
            status: 'נרשם בהצלחה',
            syncStatus: config.useSimulatedSheets ? 'נשמר מקומית (קופסה שחורה)' : 'סונכרן לגוגל שיטס'
          });
        }
      } else {
        throw new Error("Chat api communication error");
      }
    } catch (err) {
      console.error("AI service error:", err);
      const erroredReply: Message = {
        id: `msg_${Date.now()}_err`,
        sender: 'noa',
        text: "מצטערת, משהו השתבש בעיבוד המידע. אנא בדוק את חיבור השרת שלך ונסה שוב.",
        timestamp,
        toolType: "כללי"
      };
      setMessages(prev => [...prev, erroredReply]);
    } finally {
      setLoadingNoa(false);
    }
  };

  // Gesture handlers for triggering the hidden maintenance area via Noa's Logo
  const logoPressRef = useRef<any>(null);

  const startLogoPress = () => {
    logoPressRef.current = setTimeout(() => {
      setMaintenanceOpen(true);
      fetchDiagnostics();
      setToastMessage("נפתח מסך אחזקה ותחזוקת מערכת מאובטח! 🔒");
    }, 1200); // 1.2 second hold
  };

  const endLogoPress = () => {
    if (logoPressRef.current) {
      clearTimeout(logoPressRef.current);
    }
  };

  const handleLogoDoubleClick = () => {
    setMaintenanceOpen(true);
    fetchDiagnostics();
    setToastMessage("מסך אחזקה מאובטח הופעל בהצלחה! 🔓");
  };

  // Copy Google Apps Script configuration Helper
  const copyScriptText = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedScript(true);
    setToastMessage("קוד ה-Apps Script הועתק ללוח!");
    setTimeout(() => setCopiedScript(false), 3000);
  };

  // Filter logs check
  const filteredLogs = logs.filter(log => {
    if (activeTab === 'כל') return true;
    if (activeTab === 'יומן') return log.toolName === 'יומן';
    if (activeTab === 'כונן') return log.toolName === 'כונן';
    if (activeTab === 'משימות') return log.toolName === 'משימות';
    return true;
  });

  const createRealCalendarEvent = async () => {
    sendMessage("לקבוע תור פגישת טסט חירום לשעה שש בערב עם דוקטור נועה");
  };

  const createRealDriveFile = async () => {
    sendMessage("ליצור קובץ מסมך סיכום טסט חדש בכונן עם רשימת הנחיות");
  };

  return (
    <div id="noa-root-layout" className="min-h-screen bg-[#FAF6F0] text-[#1E293B] flex items-center justify-center p-0 md:p-6 antialiased selection:bg-sky-100 selection:text-sky-900 transition-colors duration-500">
      
      {/* Decorative luxury mesh background gradients for desktop layout */}
      <div className="absolute inset-0 max-w-full h-full bg-gradient-to-tr from-[#EBF8FC] via-[#FAF6F0] to-[#FAF8F5] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[20%] right-[10%] w-[35rem] h-[35rem] bg-[#E0F2FE]/20 rounded-full filter blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[20%] left-[5%] w-[40rem] h-[40rem] bg-[#FAF6F0]/50 rounded-full filter blur-[150px]"></div>
      </div>

      {/* Floating simulated push notification banner */}
      {showNotificationToast && (
        <div id="push-notification-banner" className="fixed top-6 left-6 right-6 md:left-auto md:w-96 bg-white/95 backdrop-blur-md border-l-4 border-sky-400 shadow-xl rounded-2xl p-4 z-50 flex items-start gap-4 animate-fade-in direction-rtl RTL text-right select-none">
          <div className="bg-sky-50 p-2 rounded-xl text-sky-600 shrink-0">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-sky-700 uppercase tracking-wide flex items-center gap-1.5 justify-start">
              <span>התראת דחיפה מהטלפון</span>
              <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
            </p>
            <h4 className="text-sm font-semibold text-slate-800 mt-1">{showNotificationToast.title}</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{showNotificationToast.body}</p>
          </div>
          <button 
            type="button"
            onClick={() => setShowNotificationToast(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Status Toast Notification */}
      {toastMessage && (
        <div id="status-toast" className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-slate-900/95 text-white px-5 py-3 rounded-2xl text-xs font-semibold z-50 shadow-xl flex items-center gap-2 animate-fade-in RTL direction-rtl">
          <Info className="w-4 h-4 text-sky-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container - Desktop centers the phone beautifully, mobile is clean fullscreen */}
      <div className="w-full max-w-[420px] md:h-[840px] h-screen md:max-h-[92vh] md:rounded-[48px] md:border-[12px] md:border-slate-900 bg-white shadow-2xl relative flex flex-col overflow-hidden transition-all duration-300">
        
        {/* Smartphone top status bar (Hidden on pure mobile web but mimics a real native app header) */}
        <div className="pt-2 px-6 pb-1.5 bg-[#FAF8F5] flex items-center justify-between text-[11px] font-semibold text-slate-400 shrink-0 select-none border-b border-slate-100">
          <span className="font-mono">
            {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {/* Simulated camera dot/Notch for premium hardware finish */}
          <div className="w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-slate-800 shrink-0 hidden md:block shadow-inner"></div>
          <div className="flex items-center gap-1">
            <Wifi className="w-3 h-3 text-slate-400" />
            <span className="text-[9px] font-mono font-bold text-slate-400">LTE</span>
          </div>
        </div>

        {/* Smartphone App Header Area */}
        <header className="bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between shrink-0 relative z-20 select-none">
          {/* Hamburger Menu toggle */}
          <button 
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center bg-sky-50/50 border border-sky-100 rounded-full hover:bg-sky-50 hover:scale-105 active:scale-95 transition-all text-sky-700 cursor-pointer shadow-2xs"
            title="פתח תפריט צידי"
          >
            <Menu className="w-4 h-4 text-center mx-auto" />
          </button>

          {/* Centered Logo & Brand trigger */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onMouseDown={startLogoPress}
              onMouseUp={endLogoPress}
              onMouseLeave={endLogoPress}
              onTouchStart={startLogoPress}
              onTouchEnd={endLogoPress}
              onDoubleClick={handleLogoDoubleClick}
              className="relative group focus:outline-none select-none cursor-pointer"
              title="לחיצה ארוכה או דאבל קליק לפתיחת הגדרות מערכת"
            >
              <img 
                src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                alt="Noa" 
                className="w-12 h-12 object-contain bg-[#FAF8F5] p-0.5 rounded-2xl border border-sky-100 hover:border-sky-300 hover:scale-110 active:scale-95 transition-all duration-300 pointer-events-none"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
              </span>
            </button>
            <span className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1">
              נועה • Noa
            </span>
          </div>

          {/* Connected state badge */}
          <div className="flex flex-col items-end text-left select-none">
            <div className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-100/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>ענן פעיל</span>
            </div>
            <span className="text-[8px] font-mono text-slate-400 mt-0.5">Vercel Pro</span>
          </div>
        </header>

        {/* Smartphone Screen Viewport Content (Active screens representation) */}
        <div className="flex-1 overflow-y-auto bg-[#FAF8F5] relative flex flex-col justify-between scrollbar-none">
          
          {/* SCREEN 1: CLIENT-SIDE CHAT INTERFACE */}
          {phoneScreen === 'chat' && (
            <div className="flex-1 flex flex-col justify-between h-full bg-[#FAF8F5]">
              {/* Chat Message Scrollable feed */}
              <div id="phone-chat-screen-area" className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3.5 scrollbar-none">
                
                {/* Embedded dynamic information note */}
                <div className="bg-sky-50/50 border border-sky-100 text-[#0284c7] text-[10px] px-3 py-2 rounded-xl text-center w-full max-w-[340px] mx-auto leading-relaxed shadow-2xs font-semibold select-none">
                  🌿 שלום! אני מחוברת לענן גוגל ישירות. לחיצה ארוכה על הלוגו תפתח את אזור הבקרה והמדדים.
                </div>

                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[88%] ${
                      msg.sender === 'user' ? 'self-end' : 'self-start'
                    } animate-fade-in`}
                  >
                    {/* Sender indicators */}
                    <span className={`text-[9px] text-slate-400 font-semibold mb-1 px-1 flex items-center gap-1 ${
                      msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                    }`}>
                      <span>{msg.sender === 'user' ? 'אתה' : 'נועה'}</span>
                      <span className="text-[8px] font-normal text-slate-400 font-mono">• {msg.timestamp}</span>
                    </span>

                    {/* Styled speech balloon */}
                    <div 
                      className={`px-4 py-3 rounded-2xl text-[12.5px] leading-relaxed shadow-2xs ${
                        msg.sender === 'user'
                          ? 'bg-sky-100/90 text-slate-800 rounded-bl-none font-medium border border-sky-200/50 text-right RTL direction-rtl'
                          : 'bg-white text-slate-800 rounded-br-none border border-slate-100 text-right RTL direction-rtl'
                      }`}
                      style={{ whiteSpace: 'pre-line' }}
                    >
                      {msg.text}

                      {/* Display Priority Badges if a task was handled in this node response */}
                      {msg.toolType && msg.toolType !== 'כללי' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100/70 flex items-center justify-between text-[10px] text-sky-700 font-bold">
                          <span className="flex items-center gap-1 text-sky-700/80 bg-sky-50 px-2 py-0.5 rounded border border-sky-100/30">
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                            סנכרון פעיל: {msg.toolType}
                          </span>
                          <span className="text-[9px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                            רשום בקופסה ✓
                          </span>
                        </div>
                      )}

                      {/* Styled Action Buttons */}
                      {msg.buttons && msg.buttons.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5 justify-end">
                          {msg.buttons.map((btn) => (
                            <button
                              key={btn.id || btn.text}
                              type="button"
                              onClick={() => handleButtonAction(btn)}
                              className="bg-[#FAF8F5] border border-sky-100 hover:border-sky-300 hover:bg-sky-50/40 text-slate-700 text-[10px] font-bold py-1.5 px-2.5 rounded-xl transition-all shadow-3xs flex items-center gap-1 cursor-pointer"
                            >
                              {btn.type === 'link' && <ExternalLink className="w-3 h-3 text-sky-500" />}
                              <span>{btn.text}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loadingNoa && (
                  <div className="self-start flex flex-col max-w-[85%] animate-pulse">
                    <span className="text-[9px] text-slate-400 font-semibold mb-1 px-1">נועה מקלידה...</span>
                    <div className="px-4 py-2.5 bg-white rounded-2xl rounded-br-none border border-slate-100 flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce delay-100"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce delay-200"></span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Floating Input area */}
              <div className="p-3 bg-white border-t border-slate-50 flex items-center gap-2 shrink-0 shadow-sm z-10">
                <input
                  type="text"
                  placeholder="הקלידו הודעה לנועה (יומן, כונן, משימה)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      sendMessage();
                    }
                  }}
                  className="flex-1 bg-[#FAF8F5] text-slate-800 placeholder-slate-400 rounded-full px-4 py-2.5 border border-slate-200/60 focus:outline-none focus:border-sky-300 text-xs font-semibold text-right direction-rtl transition-colors"
                />
                <button 
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={!inputText.trim()}
                  className="w-10 h-10 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4 transform rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* SCREEN 2: REAL-TIME CALENDAR SCHEDULE VIEW */}
          {phoneScreen === 'calendar' && (
            <div className="flex-1 p-4 bg-[#FAF8F5] flex flex-col gap-4 animate-fade-in RTL direction-rtl">
              <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-100 shadow-3xs select-none">
                <div className="text-right">
                  <h4 className="font-bold text-[13px] text-slate-800">פגישות קרובות</h4>
                  <p className="text-[10px] text-slate-400">לוח שנה מסונכרן בזמן אמת לגוגל 📅</p>
                </div>
                <button 
                  type="button"
                  onClick={fetchCalendar}
                  disabled={loadingCalendar}
                  className="p-2 bg-slate-50 border border-slate-100 rounded-full hover:bg-slate-100 text-slate-600 transition-colors shadow-3xs cursor-pointer flex items-center justify-center shrink-0"
                  title="רענן יומן"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCalendar ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingCalendar ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                  <span>מעדכן לוח שנה גוגל...</span>
                </div>
              ) : calendarEvents.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-center gap-2 select-none">
                  <Calendar className="w-10 h-10 text-slate-200 shrink-0 stroke-1" />
                  <p className="text-xs font-semibold">אין אירועים רשומים כעת בלוח השנה</p>
                  <p className="text-[10px] text-slate-400">פנו אל נועה בצ'אט כדי להוסיף פגישה</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 max-h-[640px] pr-1">
                  {calendarEvents.map((ev: any) => (
                    <div 
                      key={ev.id} 
                      className="p-3.5 bg-white rounded-2xl border border-sky-50/50 hover:border-sky-100 hover:shadow-2xs transition-all flex flex-col justify-between shadow-3xs text-right animate-fade-in"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-bold text-xs text-slate-800 truncate leading-snug">{ev.summary}</h5>
                          <span className="text-[9px] bg-sky-50 text-sky-600 font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                            פגישה
                          </span>
                        </div>
                        {ev.description && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{ev.description}</p>}
                        {ev.location && (
                          <p className="text-[9.5px] text-[#0284c7] font-semibold mt-1.5 flex items-center gap-1 justify-start">
                            <span>📍</span>
                            <span className="truncate">{ev.location}</span>
                          </p>
                        )}
                        <span className="text-[9px] text-slate-400 font-semibold font-mono block mt-2.5 bg-[#FAF8F5] py-1 px-2 rounded-lg text-center w-fit border border-slate-100">
                          ⏰ {new Date(ev.start).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      {ev.htmlLink && (
                        <a 
                          href={ev.htmlLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="mt-3 block text-center text-[10px] font-bold bg-sky-50 hover:bg-sky-100/70 text-sky-700 py-1.5 px-3 rounded-xl border border-sky-100/50 transition-all select-none"
                        >
                          פתח ביומן Google חיצוני 📅
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SCREEN 3: REAL-TIME DRIVE DOCUMENTS VIEW */}
          {phoneScreen === 'drive' && (
            <div className="flex-1 p-4 bg-[#FAF8F5] flex flex-col gap-4 animate-fade-in RTL direction-rtl">
              <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-100 shadow-3xs select-none">
                <div className="text-right">
                  <h4 className="font-bold text-[13px] text-slate-800">מסמכי Google Drive</h4>
                  <p className="text-[10px] text-slate-400">ארכיון ענן מנוטר ומסונכרן 📁</p>
                </div>
                <button 
                  type="button"
                  onClick={fetchDriveFiles}
                  disabled={loadingDrive}
                  className="p-2 bg-slate-50 border border-slate-100 rounded-full hover:bg-slate-100 text-slate-600 transition-colors shadow-3xs cursor-pointer flex items-center justify-center shrink-0"
                  title="רענן כונן"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDrive ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingDrive ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                  <span>טוען מסמכים מגוגל דרייב...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 text-center gap-2 select-none">
                  <FileText className="w-10 h-10 text-slate-200 shrink-0 stroke-1" />
                  <p className="text-xs font-semibold">לא נמצאו קבצים בחשבון הדרייב</p>
                  <p className="text-[10px] text-slate-400">בקשו מנועה ליצור קובץ גיבוי מיוחד</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[640px] pr-1">
                  {driveFiles.map((file: any) => (
                    <div 
                      key={file.id} 
                      className="p-3 bg-white rounded-2xl border border-slate-100 hover:border-emerald-100 hover:shadow-3xs transition-all flex items-center justify-between gap-3 text-right shadow-3xs animate-fade-in"
                    >
                      <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-xs text-slate-800 truncate leading-snug">{file.name}</h5>
                        <p className="text-[9px] text-slate-400 mt-1">
                          עודכן: {new Date(file.modifiedTime).toLocaleDateString("he-IL")} {file.size ? `• ${file.size}` : ''}
                        </p>
                      </div>
                      {file.webViewLink && (
                        <a 
                          href={file.webViewLink} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="shrink-0 text-center text-[10px] font-bold bg-sky-100/60 hover:bg-sky-100 text-[#0284c7] py-1.5 px-3 rounded-xl transition-all border border-sky-100/50 whitespace-nowrap select-none"
                        >
                          פתחי קובץ 📂
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SCREEN 4: REAL-TIME TASKS MANAGEMENT VIEW */}
          {phoneScreen === 'tasks' && (
            <div className="flex-1 p-4 bg-[#FAF8F5] flex flex-col gap-4 animate-fade-in overflow-y-auto scrollbar-none RTL direction-rtl">
              <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-100 shadow-3xs shrink-0 select-none">
                <div className="text-right">
                  <h4 className="font-bold text-[13px] text-slate-800">משימות Google Tasks</h4>
                  <p className="text-[10px] text-slate-400">ניהול עדיפויות מובנה ומסונכרן 📋</p>
                </div>
                <button 
                  type="button"
                  onClick={fetchGoogleTasks}
                  disabled={loadingTasks}
                  className="p-2 bg-slate-50 border border-slate-100 rounded-full hover:bg-slate-100 text-slate-600 transition-colors shadow-3xs cursor-pointer flex items-center justify-center shrink-0"
                  title="רענן משימות"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Inline Task Creation Form inside UI */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTaskTitle.trim()) return;
                  setIsCreatingTask(true);
                  await createRealGoogleTask(newTaskTitle, newTaskNotes, newTaskPriority, newTaskCategory);
                  setNewTaskTitle("");
                  setNewTaskNotes("");
                  setNewTaskPriority("Medium");
                  setNewTaskCategory("Personal");
                  setIsCreatingTask(false);
                }}
                className="p-4 bg-white rounded-2xl border border-slate-100 flex flex-col gap-3 text-right shadow-3xs shrink-0 animate-fade-in"
              >
                <div className="text-[11px] font-bold text-sky-800 border-b border-sky-50 pb-2 flex items-center gap-1 select-none">
                  <span>➕ משימה חכמה חדשה עם קטגוריה ועדיפות</span>
                </div>
                
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 select-none">כותרת המשימה:</label>
                    <input 
                      type="text"
                      required
                      placeholder="לדוגמה: פגישת סיכום מול דודי"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-[#FAF8F5] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-300 transition-all text-right font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 select-none">עדיפות (Priority):</label>
                      <div className="grid grid-cols-3 gap-0.5 bg-[#FAF8F5] p-0.5 rounded-xl border border-slate-200/60 select-none">
                        <button
                          type="button"
                          onClick={() => setNewTaskPriority("High")}
                          className={`text-[9px] py-2 rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            newTaskPriority === 'High' 
                              ? 'bg-red-50 text-red-700 border border-red-200' 
                              : 'hover:bg-white text-slate-400 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                          <span>גבוהה</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTaskPriority("Medium")}
                          className={`text-[9px] py-2 rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            newTaskPriority === 'Medium' 
                              ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                              : 'hover:bg-white text-slate-400 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          <span>בינונית</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTaskPriority("Low")}
                          className={`text-[9px] py-2 rounded-lg font-bold transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                            newTaskPriority === 'Low' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-205' 
                              : 'hover:bg-white text-slate-400 border border-transparent'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
                          <span>נמוכה</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1 select-none">קטגוריה (Category):</label>
                      <select
                        value={newTaskCategory}
                        onChange={(e) => setNewTaskCategory(e.target.value as any)}
                        className="w-full text-[11px] p-2 rounded-xl border border-slate-200 bg-[#FAF8F5] text-slate-800 focus:outline-none focus:border-sky-300 transition-all text-right font-semibold cursor-pointer h-[38px]"
                      >
                        <option value="Personal">אישי • Personal</option>
                        <option value="Work">עבודה • Work</option>
                        <option value="Shopping">קניות • Shopping</option>
                        <option value="Other">אחר • Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1 select-none">פירוט והערות נוספות:</label>
                    <textarea 
                      placeholder="הערות שיופיעו בתיאור המשימה בגוגל..."
                      value={newTaskNotes}
                      onChange={(e) => setNewTaskNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-[#FAF8F5] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-300 transition-all text-right resize-none font-medium"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-1 shrink-0">
                  <button
                    type="submit"
                    disabled={isCreatingTask || !newTaskTitle.trim()}
                    className="w-full bg-sky-500 hover:bg-sky-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-bold text-xs py-2.5 rounded-xl border border-sky-600/20 shadow-xs transition-all cursor-pointer select-none"
                  >
                    {isCreatingTask ? 'שומר משימה בגוגל...' : 'הוסף משימה לקופסה 📋'}
                  </button>
                </div>
              </form>

              {loadingTasks ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-2 shrink-0">
                  <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
                  <span>מעדכן משימות גוגל...</span>
                </div>
              ) : googleTasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-400 text-center gap-2 shrink-0 select-none">
                  <ListTodo className="w-10 h-10 text-slate-200 stroke-1 shrink-0" />
                  <p className="text-xs font-semibold">אין משימות פעילות</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto flex flex-col gap-4 max-h-[420px] pr-1 pb-4 shrink-0 font-sans">
                  {['Personal', 'Work', 'Shopping', 'Other'].map((categoryKey) => {
                    const categoryTasks = googleTasks.filter((t: any) => {
                      const tCat = (t.category || 'Other').toLowerCase();
                      if (categoryKey.toLowerCase() === 'other') {
                        return !['personal', 'work', 'shopping'].includes(tCat);
                      }
                      return tCat === categoryKey.toLowerCase();
                    });

                    if (categoryTasks.length === 0) return null;

                    let headerStyles = "bg-slate-50 text-slate-700 border-slate-200/80";
                    let hebrewCategoryLabel = "אחר";
                    let dotColor = "bg-slate-400";

                    if (categoryKey === 'Personal') {
                      headerStyles = "bg-emerald-50/75 text-emerald-800 border-emerald-100";
                      hebrewCategoryLabel = "אישי";
                      dotColor = "bg-emerald-500";
                    } else if (categoryKey === 'Work') {
                      headerStyles = "bg-sky-50/75 text-sky-800 border-sky-100";
                      hebrewCategoryLabel = "עבודה";
                      dotColor = "bg-sky-500";
                    } else if (categoryKey === 'Shopping') {
                      headerStyles = "bg-purple-50/75 text-purple-800 border-purple-100";
                      hebrewCategoryLabel = "קניות";
                      dotColor = "bg-purple-500";
                    }

                    return (
                      <div key={categoryKey} className="flex flex-col gap-2 animate-fade-in text-right">
                        {/* Colored Group Header */}
                        <div className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between shadow-3xs select-none ${headerStyles}`}>
                          <div className="flex items-center gap-1.5 justify-start">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                            <span>{hebrewCategoryLabel} • {categoryKey}</span>
                          </div>
                          <span className="text-[9px] bg-white border border-slate-100 px-2 py-0.5 rounded-full font-mono font-bold leading-none text-slate-500">
                            {categoryTasks.length} {categoryTasks.length === 1 ? 'משימה' : 'משימות'}
                          </span>
                        </div>

                        {/* Category Tasks List */}
                        <div className="flex flex-col gap-2">
                          {categoryTasks.map((t: any) => (
                            <div 
                              key={t.id} 
                              className="p-3 bg-white rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-right shadow-3xs hover:border-slate-200 transition-all animate-fade-in"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input 
                                  type="checkbox" 
                                  checked={t.status === 'completed'} 
                                  readOnly 
                                  className="w-4 h-4 accent-sky-500 rounded-lg cursor-pointer shrink-0"
                                />
                                <div className="text-right min-w-0">
                                  <span className={`font-bold text-xs block truncate ${
                                    t.status === 'completed' ? 'line-through text-slate-400 font-normal' : 'text-slate-800'
                                  }`}>
                                    {t.title}
                                  </span>
                                  {t.notes && <p className="text-[10px] text-slate-500 mt-0.5 font-medium truncate">{t.notes}</p>}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0 select-none font-sans mt-0.5">
                                {t.priority === 'High' && (
                                  <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none shrink-0">
                                    <span className="w-1 h-1 rounded-full bg-red-500"></span>
                                    גבוהה
                                  </span>
                                )}
                                {t.priority === 'Medium' && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none shrink-0">
                                    <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                    בינונית
                                  </span>
                                )}
                                {t.priority === 'Low' && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-750 border border-emerald-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none shrink-0">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                                    נמוכה
                                  </span>
                                )}

                                {t.due && (
                                  <span className="text-[8px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                                    עד: {new Date(t.due).toLocaleDateString("he-IL")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* BOTTOM NAV BAR (Dynamic premium mobile navigations) */}
        <nav className="bg-white border-t border-slate-100/70 h-[64px] grid grid-cols-4 items-center shrink-0 z-20 select-none border-b">
          <button 
            type="button"
            onClick={() => setPhoneScreen('chat')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold h-full transition-colors cursor-pointer ${
              phoneScreen === 'chat' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Send className="w-4 h-4 text-center mx-auto" />
            <span>צ'אט נועה</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setPhoneScreen('calendar')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold h-full transition-colors cursor-pointer ${
              phoneScreen === 'calendar' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar className="w-4 h-4 text-center mx-auto" />
            <span>יומן פגישות</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setPhoneScreen('drive')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold h-full transition-colors cursor-pointer ${
              phoneScreen === 'drive' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <FileText className="w-4 h-4 text-center mx-auto" />
            <span>קבצי כונן</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setPhoneScreen('tasks')}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold h-full transition-colors cursor-pointer ${
              phoneScreen === 'tasks' ? 'text-sky-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ListTodo className="w-4 h-4 text-center mx-auto" />
            <span>משימות</span>
          </button>
        </nav>

        {/* DRAWER MENU OVERLAY (Hamburger menu) within smartphone frame */}
        {isSidebarOpen && (
          <div className="absolute inset-0 bg-black/50 z-40 transition-opacity animate-fade-in flex justify-end">
            <div className="w-4/5 bg-[#FAF8F5] shadow-2xl p-5 flex flex-col h-full transform translate-x-0 transition-transform duration-300 animate-slide-in-right">
              {/* Drawer Brand Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 RTL direction-rtl text-right">
                <div className="flex items-center gap-2">
                  <img 
                    src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                    alt="Logo" 
                    className="w-9 h-9 rounded-xl bg-white p-0.5 border border-slate-100"
                  />
                  <span className="font-bold text-sm text-slate-800">העוזרת נועה</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center hover:bg-slate-200 transition-colors cursor-pointer animate-fade-in"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              {/* Drawer Links and System Utilities */}
              <div className="py-4 flex-1 flex flex-col gap-2.5 RTL direction-rtl text-right overflow-y-auto">
                {/* Firebase Profile State Indicator */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200/50 shadow-3xs mb-1 text-right">
                  {currentUser ? (
                    <div className="flex items-center gap-2.5 justify-start">
                      {currentUser.photoURL ? (
                        <img 
                          src={currentUser.photoURL} 
                          alt="User" 
                          referrerPolicy="no-referrer" 
                          className="w-8 h-8 rounded-full border border-sky-100"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {currentUser.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-right leading-none">
                        <p className="text-xs font-bold text-slate-700 truncate">{currentUser.displayName || currentUser.email}</p>
                        <span className="text-[9px] text-[#4CAF50] font-bold block mt-1">ענן מאובטח 🔒</span>
                      </div>
                      <button 
                        type="button"
                        onClick={async () => {
                          await signOut(auth);
                          setToastMessage("התנתקת בהצלחה!");
                          setIsSidebarOpen(false);
                        }}
                        className="text-[10px] text-red-500 font-bold hover:underline cursor-pointer"
                      >
                        יציאה
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-medium mb-2">חברו את המכשיר לפרופיל Google Cloud</p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const result = await signInWithPopup(auth, googleProvider);
                            if (result.user) {
                              setToastMessage(`שלום ${result.user.displayName}! החיבור אומת מול שרתי Firebase קישורי ענן`);
                            }
                            setIsSidebarOpen(false);
                          } catch (err: any) {
                            setToastMessage("תקלה בחיבור מול Firebase");
                          }
                        }}
                        className="w-full py-1.5 px-3 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-bold transition-all border border-sky-200/40 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>חיבור וסנכרון Google Cloud</span>
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">פקודות מהירות (שינון נועה)</p>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setPhoneScreen('chat');
                    sendMessage("אלו אירועים קיימים לי היום בלוח השנה?");
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all text-right cursor-pointer"
                >
                  <span className="bg-sky-50 p-1.5 rounded-lg text-sky-600">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <span>בדקי את אירועי היומן שלי 📅</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setPhoneScreen('chat');
                    sendMessage("תזכירי לי לבדוק את הגדרות האבטחה היום בצהריים");
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all text-right cursor-pointer"
                >
                  <span className="bg-sky-50 p-1.5 rounded-lg text-sky-600">
                    <ListTodo className="w-4 h-4" />
                  </span>
                  <span>רישום משימה חדשה לקופסה 📋</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setPhoneScreen('chat');
                    sendMessage("נועה, תמצאי קבצי גיבוי בכונן שלי");
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all text-right cursor-pointer"
                >
                  <span className="bg-sky-50 p-1.5 rounded-lg text-sky-600">
                    <FileText className="w-4 h-4" />
                  </span>
                  <span>סנכרון וחיפוש קובץ בכונן 📁</span>
                </button>

                <div className="h-px bg-slate-200/70 my-2"></div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">חיישנים ומדדי GPS מכשיר</p>
                
                {/* Physical GPS Details inside drawer */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200/50">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-1.5">
                    <span>חיישן מיקום GPS</span>
                    <span className="text-sky-600 text-[10px] font-bold">{geoMode === 'real' ? 'חיישן חי 🟢' : 'סימולציה 🟡'}</span>
                  </div>
                  <div className="bg-[#FAF8F5] p-2 rounded-xl border border-slate-100 flex items-center gap-2 text-right">
                    <MapPin className="w-4 h-4 text-sky-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{getLocationString()}</p>
                      <p className="text-[9px] text-slate-400 font-mono">
                        {coords ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'קובע נתוני לוויין...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGeoMode('real');
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(p => {
                            setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude });
                            setToastMessage("חיישן GPS נייד סומכרן בהצלחה! 📡");
                          });
                        }
                      }}
                      className={`text-[9.5px] font-bold flex-1 py-1 rounded-lg border transition-all cursor-pointer ${
                        geoMode === 'real' ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-400 border-none'
                      }`}
                    >
                      מיקום חי
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeoMode('simulated');
                        setCoords({ latitude: 32.0853, longitude: 34.7818 });
                        setToastMessage("מופעלת סימולציית GPS: תל אביב");
                      }}
                      className={`text-[9.5px] font-bold flex-1 py-1 rounded-lg border transition-all cursor-pointer ${
                        geoMode === 'simulated' ? 'bg-sky-100 text-sky-700 border-sky-200' : 'bg-slate-100 text-slate-400 border-none'
                      }`}
                    >
                      סימולציה
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-200/70 my-2"></div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Schema Intent links (חיבורי מערכת)</p>
                
                <a
                  href="tel:*2525"
                  className="flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all text-right"
                >
                  <span className="bg-sky-50 p-1 rounded-lg text-sky-600">
                    <Phone className="w-3.5 h-3.5 text-center mx-auto" />
                  </span>
                  <span>חייג אלינו (dial :tel)</span>
                </a>

                <a
                  href="mailto:help@noa-assistant.cloud"
                  className="flex items-center gap-3 p-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all text-right"
                >
                  <span className="bg-sky-50 p-1 rounded-lg text-sky-600">
                    <Mail className="w-3.5 h-3.5 text-center mx-auto" />
                  </span>
                  <span>כתוב דואר (mailto)</span>
                </a>
              </div>

              {/* SECURE SYSTEM BACKDOOR: Bottom drawer triggers maintenance screen */}
              <div className="mt-auto pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMaintenanceOpen(true);
                    setIsSidebarOpen(false);
                    fetchDiagnostics();
                  }}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-800 text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-sky-300" />
                  <span>אזור ניהול ותחזוקת ענן 🔒</span>
                </button>
                <div className="text-center">
                  <p className="text-[9px] text-slate-400">נועה - Premium Virtual Companion v3.4</p>
                  <p className="text-[8px] text-slate-400 mt-0.5">Secure Google API Black Box Sync Node</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* SECURE OUT-OF-SIGHT SYSTEM MAINTENANCE OVERLAY (דף אחזקה ייעודי ומוגן) */}
        {/* ======================================================================= */}
        {maintenanceOpen && (
          <MaintenanceOverlay
            onClose={() => setMaintenanceOpen(false)}
            config={config}
            setConfig={setConfig}
            saveConfiguration={saveConfiguration}
            diagnostics={diagnostics}
            loadingDiagnostics={loadingDiagnostics}
            fetchDiagnostics={fetchDiagnostics}
            filteredLogs={filteredLogs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            googleAppsScriptCode={googleAppsScriptCode}
            copiedScript={copiedScript}
            copyScriptText={copyScriptText}
            triggerPushNotification={triggerPushNotification}
            setToastMessage={setToastMessage}
            createRealCalendarEvent={createRealCalendarEvent}
            createRealDriveFile={createRealDriveFile}
          />
        )}

      </div>
      
    </div>
  );
}
