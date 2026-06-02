import { useState, useEffect, useRef } from 'react';
import { 
  Send, Menu, MapPin, Bell, Database, Copy, Check, ExternalLink, 
  Layers, RefreshCw, Sliders, Calendar, FileText, ListTodo, 
  HelpCircle, Info, ChevronRight, X, Phone, Mail, Navigation, Heart
} from 'lucide-react';
import { googleAppsScriptCode } from './data/appsScriptCode';
import { Message, BlackBoxLog, ToolType, SystemConfig } from './types';

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
      text: "שלום! אני נועה, העוזרת האישית שלכם. 🌟\nשילוב המערכת פועל ברקע – כל פנייה שלכם תנותח, תנותב לכלי הנכון (יומן, כונן, משימות) ותתועד אוטומטית במדויק בקופסה השחורה בגוגל שיטס.",
      timestamp: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
      toolType: "כללי",
      buttons: [
        { id: "btn_demo_task", text: "תוסיפי משימה דחופה", type: "quick_reply", payload: "נועה, תוסיפי לי משימה דחופה לבדוק את התחזית השבועית" },
        { id: "btn_demo_cal", text: "רשמי פגישה מחר", type: "quick_reply", payload: "נועה, תאמי לי פגישה עם המעצב למחר ב-10:00 בבוקר" }
      ]
    }
  ]);
  const [inputText, setInputText] = useState("");
  const [loadingNoa, setLoadingNoa] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Authentication States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // System Configuration & Logs States
  const [config, setConfig] = useState<SystemConfig>({
    appsScriptUrl: "https://script.google.com/macros/s/AKfycbz8bzkxFD5ojmMUU_OiwGhIG9SxEz5NfN1VylIcnW7pOLlA6gqLzRZorNgSd5rwSnfa7g/exec",
    useSimulatedSheets: false,
    spreadsheetUrl: ""
  });
  const [logs, setLogs] = useState<BlackBoxLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'כל' | 'יומן' | 'כונן' | 'משימות' | 'הסבר'>('כל');

  // Real Google Workspace states (Fetched in real-time from backend APIs)
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [googleTasks, setGoogleTasks] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // New Google Tasks creation tool states (with Priority level field)
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNotes, setNewTaskNotes] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Fetch real Google Calendar Events
  const fetchCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCalendarEvents(data.events || []);
        }
      }
    } catch (e) {
      console.error("Error fetching calendar events:", e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Fetch real Google Drive Files
  const fetchDriveFiles = async () => {
    setLoadingDrive(true);
    try {
      const res = await fetch("/api/drive");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDriveFiles(data.files || []);
        }
      }
    } catch (e) {
      console.error("Error fetching drive files:", e);
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
        if (data.success) {
          setGoogleTasks(data.tasks || []);
        }
      }
    } catch (e) {
      console.error("Error fetching tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Create Real Google Calendar Event from UI
  const createRealCalendarEvent = async () => {
    const summary = window.prompt("הזן כותרת לפגישה חדשה ביומן גוגל (היצירה מתבצעת בזמן אמת!):", "פגישת עבודה מתוזמנת");
    if (!summary) return;

    setLoadingLogs(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          description: "נוצר ישירות דרך ממשק הפיתוח של נועה",
          location: getLocationString(),
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setToastMessage(`הפגישה "${summary}" נוצרה בהצלחה ביומן הגוגל האמיתי! 📅`);
          triggerPushNotification("פגישה חדשה נקלטה ביומן", summary);
          fetchCalendar();
          fetchEnvAndLogs();
        }
      } else {
        const errData = await res.json();
        setToastMessage(`שגיאה ביצירת פגישה: ${errData.error || 'נסה שוב'}`);
      }
    } catch (err) {
      console.error("Calendar creation failed:", err);
      setToastMessage("שגיית תקשורת בעת יצירת פגישה");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Create Real Google Drive File from UI
  const createRealDriveFile = async () => {
    const name = window.prompt("הזן שם למסמך חדש שיווצר בגוגל דרייב (זמן אמת):", "סיכום_מערכת_נועה.doc");
    if (!name) return;

    setLoadingLogs(true);
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          content: "מסמך זה נוצר ביוזמה ישירה מממשק המנהל של נועה העוזרת הניידת.",
          type: "file"
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setToastMessage(`הקובץ "${name}" נוצר בהצלחה בגוגל דרייב האמיתי! 📁`);
          triggerPushNotification("קובץ חדש נוצר בכונן של נועה", name);
          fetchDriveFiles();
          fetchEnvAndLogs();
        }
      } else {
        const errData = await res.json();
        setToastMessage(`שגיאה ביצירת קובץ: ${errData.error || 'נסה שוב'}`);
      }
    } catch (err) {
      console.error("Drive file creation failed:", err);
      setToastMessage("שגיית תקשורת בעת שמירה לדרייב");
    } finally {
      setLoadingLogs(false);
    }
  };

  // Create Real Google Task from UI
  const createRealGoogleTask = async (titleArg?: string, notesArg?: string, priorityArg?: "High" | "Medium" | "Low") => {
    let title = titleArg;
    let priority: string = priorityArg || "Medium";
    let notes = notesArg || "נוסף ידנית דרך ממשק פאנל המשימות המאובטח";

    if (!title) {
      title = window.prompt("הזן כותרת למשימה חדשה בגוגל Tasks (זמן אמת):", "משימה דחופה לטיפול") || undefined;
      if (!title) return;

      const pInput = window.prompt("הזן עדיפות למשימה: High (גבוהה), Medium (בינונית), Low (נמוכה) - ברירת מחדל Medium:", "High");
      if (pInput) {
        const cleaned = pInput.trim().toLowerCase();
        if (cleaned === 'high' || cleaned === 'גבוה') priority = 'High';
        else if (cleaned === 'low' || cleaned === 'נמוך') priority = 'Low';
        else priority = 'Medium';
      }
    }

    setLoadingLogs(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          notes,
          priority
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setToastMessage(`המשימה "${title}" נוספה בהצלחה עם עדיפות ${priority === 'High' ? 'גבוהה 🔴' : priority === 'Medium' ? 'בינונית 🟡' : 'נמוכה 🟢'}! 📋`);
          triggerPushNotification("משימה חדשה נקלטה במערכת", title);
          fetchGoogleTasks();
          fetchEnvAndLogs();
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

  // Effect to load real data when activeTab changes
  useEffect(() => {
    if (activeTab === 'יומן') {
      fetchCalendar();
    } else if (activeTab === 'כונן') {
      fetchDriveFiles();
    } else if (activeTab === 'משימות') {
      fetchGoogleTasks();
    }
  }, [activeTab]);


  // Geolocation States
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoMode, setGeoMode] = useState<'real' | 'simulated'>('simulated');
  const [simulatedCity, setSimulatedCity] = useState("תל אביב, ישראל");

  // Notifications simulation
  const [pushNotifications, setPushNotifications] = useState<Array<{ id: string; title: string; body: string; time: string }>>([]);
  const [showNotificationToast, setShowNotificationToast] = useState<{ title: string; body: string } | null>(null);
  
  // App General states
  const [copiedScript, setCopiedScript] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMobileScreenPreview, setIsMobileScreenPreview] = useState(false); // responsiveness helper

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // On Mount: Setup GPS listeners + Firebase Authentication hooks
  useEffect(() => {
    // Attempt real geo-location on load
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

  // Fetch Environment setup status and sync logs
  const fetchEnvAndLogs = async () => {
    setLoadingLogs(true);
    try {
      // 1. Get Environmental check
      const envRes = await fetch("/api/env-check");
      if (envRes.ok) {
        const envData = await envRes.json();
        if (envData.hasAppsScriptUrl) {
          setConfig(prev => ({
            ...prev,
            appsScriptUrl: envData.appsScriptUrl,
            useSimulatedSheets: false
          }));
        }
      }

      // 2. Load logs
      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        if (logsData.success) {
          setLogs(logsData.logs);
          if (logsData.spreadsheetUrl) {
            setConfig(prev => ({ ...prev, spreadsheetUrl: logsData.spreadsheetUrl }));
          }
        }
      }
    } catch (e) {
      console.error("Error loading initial data", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Update Config
  const saveConfiguration = async (url: string, simulated: boolean) => {
    if (currentUser) {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          email: currentUser.email || '',
          appsScriptUrl: url,
          useSimulatedSheets: simulated,
          spreadsheetUrl: config.spreadsheetUrl || ''
        }, { merge: true });
        
        setConfig(prev => ({
          ...prev,
          appsScriptUrl: url,
          useSimulatedSheets: simulated
        }));
        setToastMessage(simulated ? "המערכת עברה למצב הדמיה מקומי בענן" : "כתובת ה-Apps Script עודכנה בהצלחה בענן!");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        setToastMessage("שגיאה בשמירת התצורה בענן");
      }
    } else {
      try {
        const res = await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appsScriptUrl: url, useSimulatedSheets: simulated })
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
        addNewManualLog("כללי", `סנכרון מיקום יזום: ${getLocationString()}`, "מיקום אושר בהצלחה");
      }
    }
  };

  // Add Log Manually to Black Box
  const addNewManualLog = async (tool: ToolType, description: string, extra: string) => {
    const timestamp = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    const locationStr = getLocationString();

    if (currentUser) {
      try {
        const newLogId = `log_${Date.now()}`;
        const logDocRef = doc(db, 'users', currentUser.uid, 'logs', newLogId);
        
        const logPayload = {
          timestamp,
          toolName: tool,
          description,
          location: locationStr,
          status: 'נרשם בהצלחה' as const,
          syncStatus: (config.appsScriptUrl && !config.useSimulatedSheets) ? 'סונכרן לגוגל שיטס' as const : 'נשמר מקומית (קופסה שחורה)' as const,
          extraDetails: extra || 'תיעוד ידני מלוח בקרה'
        };

        if (config.appsScriptUrl && !config.useSimulatedSheets) {
          try {
            const res = await fetch(config.appsScriptUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                toolName: tool,
                description,
                location: locationStr,
                extraDetails: logPayload.extraDetails,
                timestamp
              })
            });
            const p = await res.json();
            if (p && p.status === 'success' && p.spreadsheetUrl) {
              await setDoc(doc(db, 'users', currentUser.uid), { spreadsheetUrl: p.spreadsheetUrl }, { merge: true });
              setConfig(prev => ({ ...prev, spreadsheetUrl: p.spreadsheetUrl }));
            }
          } catch (e) {
            console.error("Manual log Apps Script sync failed:", e);
          }
        }

        await setDoc(logDocRef, logPayload);
        setToastMessage("פעולה ידנית נוספה בהצלחה בענן!");
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}/logs`);
      }
    } else {
      try {
        const res = await fetch("/api/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: tool,
            description: description,
            location: locationStr,
            extraDetails: extra
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setLogs(prev => [data.log, ...prev]);
            if (data.spreadsheetUrl) {
              setConfig(prev => ({ ...prev, spreadsheetUrl: data.spreadsheetUrl }));
            }
          }
        }
      } catch (e) {
        console.error("Error creating log record", e);
      }
    }
  };

  // Send Message to Noa Chat Engine
  const sendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || text.trim() === "") return;

    if (!textToSend) {
      setInputText("");
    }

    const timestamp = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    const userMsg: Message = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp,
      location: coords ? { latitude: coords.latitude, longitude: coords.longitude, address: getLocationString() } : undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setLoadingNoa(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          location: coords,
          locationString: getLocationString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
          
          if (data.message.toolType && data.message.toolType !== 'כללי') {
            triggerPushNotification(
              `נועה הפעילה: כלי ${data.message.toolType}`,
              data.message.toolActionDetails || "פרטי הפעולה נרשמו בקופסה השחורה בגוגל"
            );
          }

          if (currentUser && data.log) {
            try {
              const logDocRef = doc(db, 'users', currentUser.uid, 'logs', data.log.id);
              await setDoc(logDocRef, {
                timestamp: data.log.timestamp,
                toolName: data.log.toolName,
                description: data.log.description,
                location: data.log.location,
                status: data.log.status,
                syncStatus: data.log.syncStatus,
                extraDetails: data.message.toolActionDetails || 'תיעוד שיחת נועה'
              });
              
              if (data.spreadsheetUrl) {
                await setDoc(doc(db, 'users', currentUser.uid), { spreadsheetUrl: data.spreadsheetUrl }, { merge: true });
                setConfig(prev => ({ ...prev, spreadsheetUrl: data.spreadsheetUrl }));
              }
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/logs/${data.log.id}`);
            }
          } else {
            if (data.log) {
              setLogs(prev => [data.log, ...prev]);
            }
            if (data.spreadsheetUrl) {
              setConfig(prev => ({ ...prev, spreadsheetUrl: data.spreadsheetUrl }));
            }
          }
        }
      } else {
        throw new Error("Failed to process conversation stream");
      }
    } catch (err: any) {
      const erroredReply: Message = {
        id: `msg_err_${Date.now()}`,
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

  return (
    <div id="noa-root-layout" className="min-h-screen bg-[#FAF9F6] text-[#2C3E50] flex flex-col antialiased">
      
      {/* Dynamic Push Notification Simulation Banner (Simulates real-world device notification) */}
      {showNotificationToast && (
        <div id="push-notification-banner" className="fixed top-4 left-4 right-4 md:left-auto md:w-96 bg-white/95 backdrop-blur-md border-l-4 border-[#B2E2F2] shadow-2xl rounded-xl p-4 z-50 flex items-start gap-3 animate-bounce direction-rtl RTL text-right">
          <div className="bg-[#B2E2F2]/30 p-2 rounded-lg text-[#0369A1]">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#0369A1] uppercase tracking-wider flex items-center gap-1.5">
              <span>התראת דחיפה מהטלפון</span>
              <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
            </p>
            <h4 className="text-sm font-semibold text-slate-800 mt-0.5">{showNotificationToast.title}</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{showNotificationToast.body}</p>
          </div>
          <button 
            onClick={() => setShowNotificationToast(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Status Toast Notification */}
      {toastMessage && (
        <div id="status-toast" className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/90 text-white px-5 py-3 rounded-xl text-sm font-medium z-50 shadow-xl flex items-center gap-2 animate-fade-in">
          <Info className="w-4 h-4 text-[#B2E2F2]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header id="noa-main-header" className="bg-white border-b border-[#EAE0D5] px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
              alt="נועה לוגו" 
              className="h-10 w-10 object-contain rounded-lg bg-[#FAF9F6] p-0.5 border border-[#EAE0D5]"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">נועה • Noa Assistant</h1>
              <p className="text-xs text-slate-500 font-medium">עוזרת ניידת מחוברת ל"קופסה שחורה" בגוגל</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Firebase Google Auth Status / Actions */}
            {authLoading ? (
              <span className="text-xs text-slate-400 font-mono">טוען אבטחה...</span>
            ) : currentUser ? (
              <div className="flex items-center gap-2 bg-slate-50 border border-[#EAE0D5] p-1.5 rounded-xl">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || ''} 
                    className="w-6 h-6 rounded-full border border-slate-200" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#B2E2F2] flex items-center justify-center text-xs font-bold text-[#0369A1]">
                    {currentUser.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:flex flex-col text-right leading-none">
                  <span className="text-xs font-bold text-slate-700">{currentUser.displayName || currentUser.email}</span>
                  <span className="text-[9px] text-[#4CAF50] font-bold mt-0.5">ענן מאובטח 🔒</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await signOut(auth);
                      setToastMessage("התנתקת בהצלחה!");
                    } catch (error) {
                      console.error("Sign out error:", error);
                    }
                  }}
                  className="text-xs text-red-500 hover:text-red-700 font-bold px-2 py-1 border border-transparent hover:border-red-200 rounded-lg transition-all cursor-pointer"
                >
                  התנתק
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    const result = await signInWithPopup(auth, googleProvider);
                    if (result.user) {
                      setToastMessage(`שלום ${result.user.displayName || 'משתמש'}! התחברת בהצלחה ל-Firebase 🔒`);
                    }
                  } catch (error) {
                    console.error("Google sign in error:", error);
                    setToastMessage("שגיאה בהתחברות באמצעות גוגל");
                  }
                }}
                className="bg-[#B2E2F2]/40 hover:bg-[#B2E2F2] text-slate-800 text-xs font-bold px-3 py-2 rounded-xl border border-[#9cd4e6] flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#0369A1]" />
                <span>התחבר עם Google</span>
              </button>
            )}

            {/* Quick Switch for mobile resolution preview in desktop layout */}
            <button
              onClick={() => setIsMobileScreenPreview(!isMobileScreenPreview)}
              className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#EAE0D5] bg-[#FAF9F6] text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isMobileScreenPreview ? "תצוגת מסך מלא" : "מצב הדמיית חצי חצי"}</span>
            </button>

            <div className="flex items-center gap-1 bg-[#4CAF50]/10 text-[#4CAF50] px-3 py-1.5 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4CAF50] animate-pulse"></span>
              <span>גוגל קלאוד פעיל</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main id="noa-main-content" className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: The Phone Mockup containing "Noa" App */}
        <div id="noa-client-app-col" className={`lg:col-span-5 flex flex-col items-center ${isMobileScreenPreview ? 'mx-auto max-w-sm w-full' : ''}`}>
          
          {/* Geolocation & Status bar widget of the smartphone */}
          <div className="w-full max-w-[390px] mb-3 bg-white border border-[#EAE0D5] rounded-2xl p-3 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-400">חיישן מיקום נוכחי וזמן</span>
              <span className="text-[#0369A1] font-mono font-bold">UTC: 2026-06-02</span>
            </div>
            
            <div className="flex items-center gap-2 bg-[#FAF9F6] p-2 rounded-xl border border-[#FAF9F6]">
              <MapPin className="w-4 h-4 text-[#0369A1] shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-semibold text-slate-700 truncate">{getLocationString()}</p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}` : "בודק GPS..."}
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    setGeoMode('real');
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(pos => {
                        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                        setToastMessage("מיקום GPS אומת מהנייד!");
                      });
                    }
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                    geoMode === 'real' ? 'bg-[#B2E2F2] text-[#0369A1]' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  GPS חי
                </button>
                <button
                  onClick={() => {
                    setGeoMode('simulated');
                    setCoords({ latitude: 32.0853, longitude: 34.7818 });
                    setToastMessage("חזרה למיקום סימולטיבי: תל אביב");
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                    geoMode === 'simulated' ? 'bg-[#B2E2F2] text-[#0369A1]' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  סימולציה
                </button>
              </div>
            </div>

            {geoMode === 'simulated' && (
              <div className="flex gap-1.5 items-center mt-1">
                <span className="text-[10px] font-bold text-slate-500 shrink-0">שנה עיר:</span>
                <select
                  value={simulatedCity}
                  onChange={(e) => {
                    setSimulatedCity(e.target.value);
                    if (e.target.value === "ירושלים, ישראל") setCoords({ latitude: 31.7683, longitude: 35.2137 });
                    if (e.target.value === "תל אביב, ישראל") setCoords({ latitude: 32.0853, longitude: 34.7818 });
                    if (e.target.value === "חיפה, ישראל") setCoords({ latitude: 32.7940, longitude: 34.9896 });
                    if (e.target.value === "אילת, ישראל") setCoords({ latitude: 29.5577, longitude: 34.9519 });
                    setToastMessage(`המיקום עודכן ל-${e.target.value}`);
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-md p-1 outline-none text-[#2C3E50]"
                >
                  <option value="תל אביב, ישראל">תל אביב</option>
                  <option value="ירושלים, ישראל">ירושלים</option>
                  <option value="חיפה, ישראל">חיפה</option>
                  <option value="אילת, ישראל">אילת</option>
                </select>
              </div>
            )}
          </div>

          {/* Luxury Phone Mockup Design */}
          <div id="phone-ui-frame" className="w-full max-w-[390px] h-[720px] bg-white border-[12px] border-slate-900 rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col">
            
            {/* Smartphone Notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-6 bg-slate-900 rounded-b-2xl z-40 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-slate-800 mr-2"></span>
              <span className="w-12 h-1.5 rounded-full bg-slate-800"></span>
            </div>

            {/* Smartphone screen header background */}
            <div className="pt-8 pb-3 px-5 bg-gradient-to-b from-[#FAF9F6] to-white border-b border-[#FAF9F6] flex items-center justify-between z-10 shrink-0">
              {/* Back / Option trigger */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-9 h-9 flex items-center justify-center bg-white border border-[#EAE0D5] rounded-full hover:bg-slate-50 transition-colors shadow-xs"
              >
                <Menu className="w-4 h-4 text-slate-700" />
              </button>

              {/* Dynamic center image header */}
              <div className="flex flex-col items-center">
                <img 
                  src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                  alt="Noa Logo" 
                  className="w-11 h-11 object-contain bg-[#FAF9F6] p-0.5 rounded-xl border border-slate-100"
                />
                <span className="text-xs font-bold text-slate-800 mt-1">נועה</span>
                <span className="text-[10px] text-slate-400 font-medium">עוזרת חכמה בקשר רצוף</span>
              </div>

              {/* Device connection status indicators */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-slate-400">04:48</span>
                <div className="flex gap-0.5 items-end h-3">
                  <span className="w-1 h-1.5 bg-[#4CAF50] rounded-xs"></span>
                  <span className="w-1 h-2 bg-[#4CAF50] rounded-xs"></span>
                  <span className="w-1 h-2.5 bg-[#4CAF50] rounded-xs"></span>
                  <span className="w-1 h-3 bg-[#4CAF50] rounded-xs"></span>
                </div>
              </div>
            </div>

            {/* Simulated App Drawer Side Menu Overlay */}
            {isSidebarOpen && (
              <div className="absolute inset-0 bg-black/45 z-40 transition-opacity animate-fade-in">
                <div className="absolute right-0 top-0 bottom-0 w-4/5 bg-[#FAF9F6] shadow-2xl p-5 flex flex-col z-50 transform translate-x-0 transition-transform duration-300 animate-slide-in-right">
                  <div className="flex items-center justify-between pb-4 border-b border-[#EAE0D5]">
                    <div className="flex items-center gap-2">
                      <img 
                        src="https://i.postimg.cc/qqWtk5qr/Gemini-Generated-Image-6z6qts6z6qts6z6q.png" 
                        alt="Logo" 
                        className="w-8 h-8 rounded-md bg-white p-0.5"
                      />
                      <span className="font-bold text-sm text-slate-800">תפריט נועה</span>
                    </div>
                    <button 
                      onClick={() => setIsSidebarOpen(false)}
                      className="w-8 h-8 rounded-full bg-slate-200/50 flex items-center justify-center hover:bg-slate-200 transition-colors"
                    >
                      <X className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  {/* Sidebar links and Actions list */}
                  <div className="py-4 flex-1 flex flex-col gap-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">פעולות קיצורי דרך בנייד</p>
                    
                    <button
                      onClick={() => {
                        setIsSidebarOpen(false);
                        sendMessage("אלו אירועים קיימים לי היום בלוח השנה?");
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <Calendar className="w-4 h-4" />
                      </span>
                      <span>בדיקת יומן שבועי</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSidebarOpen(false);
                        sendMessage("תזכירי לי לקנות חלב ולחם מחר בבוקר");
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <ListTodo className="w-4 h-4" />
                      </span>
                      <span>הוספת משימה מהירה</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsSidebarOpen(false);
                        sendMessage("נועה, תייצרי גיבוי למסמך פרויקט בכונן בצורה מאובטחת");
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <FileText className="w-4 h-4" />
                      </span>
                      <span>סנכרון קובץ לכונן גוגל</span>
                    </button>

                    <div className="h-px bg-[#EAE0D5] my-2"></div>

                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">קישורים ישירים (Schema Intent)</p>
                    
                    <a
                      href="tel:*2525"
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <Phone className="w-4 h-4" />
                      </span>
                      <span>חייג למספר חירום (tel:)</span>
                    </a>

                    <a
                      href={`mailto:foo@bar.com?subject=Noa%20Update`}
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <Mail className="w-4 h-4" />
                      </span>
                      <span>שלח מייל מהיר (mailto:)</span>
                    </a>

                    <a
                      href="https://calendar.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-white border hover:border-[#EAE0D5] transition-all text-right"
                    >
                      <span className="bg-[#B2E2F2]/40 p-1.5 rounded-lg text-[#0369A1]">
                        <ExternalLink className="w-4 h-4" />
                      </span>
                      <span>פתח יומן בגלישה חיצונית</span>
                    </a>
                  </div>

                  <div className="mt-auto bg-slate-100 p-3 rounded-xl border border-slate-200 text-center">
                    <p className="text-[10px] text-slate-500">נועה - עוזרת אישית יוקרתית</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">גרסה 3.4.2 (Clean Minimalism)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages Panel Screen */}
            <div id="phone-chat-screen-area" className="flex-1 overflow-y-auto px-4 py-3 bg-[#FAF9F6] flex flex-col gap-3 scrollbar-none">
              
              {/* Notice of backup */}
              <div className="mx-auto bg-amber-50 text-amber-800 text-[10px] px-3 py-1.5 rounded-md border border-amber-200 text-center w-full max-w-[320px]">
                🔑 המערכת מחוברת מקומית או דרך סקריפט גוגל בצורה מלאה. הפעולות מתועדות אוטומטית.
              </div>

              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user' ? 'self-end' : 'self-start'
                  }`}
                >
                  {/* Sender title */}
                  <span className={`text-[9px] text-slate-400 font-semibold mb-1 ${
                    msg.sender === 'user' ? 'text-left' : 'text-right'
                  }`}>
                    {msg.sender === 'user' ? 'אתה' : 'נועה'} • {msg.timestamp}
                  </span>

                  {/* Chat speech bubble */}
                  <div 
                    className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#B2E2F2] text-slate-800 rounded-bl-sm font-medium border-b border-[#9cd4e6] text-right RTL direction-rtl'
                        : 'bg-white text-slate-800 rounded-br-sm border border-[#EAE0D5] shadow-xs text-right RTL direction-rtl'
                    }`}
                    style={{ whiteSpace: 'pre-line' }}
                  >
                    {msg.text}

                    {/* Integrated dynamic tools detection metadata */}
                    {msg.toolType && msg.toolType !== 'כללי' && (
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-[#0369A1] font-bold">
                        <span>סונכרן לכלי: {msg.toolType}</span>
                        <div className="flex items-center gap-1 text-[9px] bg-[#B2E2F2]/30 px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3" />
                          <span>תועד בקופסה</span>
                        </div>
                      </div>
                    )}

                    {/* Dynamic Action Buttons in Noa's custom template bubble */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 justify-end">
                        {msg.buttons.map((btn) => (
                          <button
                            key={btn.id || btn.text}
                            onClick={() => handleButtonAction(btn)}
                            className="bg-[#FAF9F6] border border-[#EAE0D5] hover:border-slate-400 text-slate-800 text-[10px] font-bold py-1.5 px-2.5 rounded-lg transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          >
                            {btn.type === 'link' && <ExternalLink className="w-3 h-3 text-[#0369A1]" />}
                            <span>{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loadingNoa && (
                <div className="self-start flex flex-col max-w-[85%]">
                  <span className="text-[9px] text-slate-400 font-semibold mb-1">נועה חושבת...</span>
                  <div className="px-4 py-2 bg-slate-100 rounded-2xl rounded-br-none border border-slate-200 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce delay-200"></span>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Simulated Smart Input container */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="כתבו הודעה לנועה..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage();
                  }
                }}
                className="flex-1 bg-[#FAF9F6] text-slate-800 rounded-full px-4 py-2 border border-slate-200 focus:outline-none focus:border-[#B2E2F2] text-xs font-semibold text-right direction-rtl"
              />
              <button 
                onClick={() => sendMessage()}
                className="w-10 h-10 bg-[#B2E2F2] text-slate-800 rounded-full flex items-center justify-center hover:bg-opacity-80 active:scale-95 transition-all shadow-xs cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4 transform rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deployed System Configuration and Google Black Box Logs Dashboard */}
        <div id="noa-admin-panel-col" className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Admin Panel Welcome */}
          <div className="bg-white border border-[#EAE0D5] rounded-3xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#EAE0D5]">
              <div className="text-right">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 md:justify-start">
                  <span>לוח בקרה וקופסה שחורה</span>
                  <Database className="w-5 h-5 text-[#0369A1]" />
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ניהול קוד הסנכרון הדו-כיווני, קובצי Apps Script, ומעקב יומני שינון מלאים
                </p>
              </div>

              {/* Toggle to view actual Sheets vs Simulated */}
              <div className="flex items-center gap-1.5 bg-[#FAF9F6] p-1 rounded-xl border border-[#EAE0D5] self-end md:self-auto">
                <button
                  onClick={() => saveConfiguration(config.appsScriptUrl, true)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    config.useSimulatedSheets 
                      ? 'bg-white text-slate-800 shadow-2xs border border-[#EAE0D5]' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  אחסון מקומי
                </button>
                <button
                  onClick={() => saveConfiguration(config.appsScriptUrl, false)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    !config.useSimulatedSheets 
                      ? 'bg-white text-slate-800 shadow-2xs border border-[#EAE0D5]' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  סנכרון לענן גוגל (Live)
                </button>
              </div>
            </div>

            {/* Connection configuration input */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700 block text-right">
                כתובת ה-Webhook (קישור פריסת Web App של Google Apps Script)
              </label>
              
              <div className="flex flex-col md:flex-row items-stretch gap-2">
                <input
                  type="text"
                  placeholder="הדביקו כאן את כתובת ה-Deployment URL שלכם מגוגל סקריפט"
                  value={config.appsScriptUrl}
                  onChange={(e) => setConfig({ ...config, appsScriptUrl: e.target.value })}
                  className="flex-1 bg-[#FAF9F6] border border-slate-200 text-slate-800 outline-none rounded-xl px-4 py-2 text-xs focus:border-[#B2E2F2] font-mono text-left"
                />
                <button
                  onClick={() => saveConfiguration(config.appsScriptUrl, false)}
                  className="bg-[#B2E2F2] text-slate-800 hover:bg-opacity-80 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  חבר וסנכרן
                </button>
              </div>

              {/* Feedback status based on chosen option */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mt-2 text-xs bg-[#FAF9F6] p-3 rounded-xl border border-[#EAE0D5]">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.useSimulatedSheets ? 'bg-amber-500' : 'bg-emerald-500'} animate-pulse`}></span>
                  <span className="font-bold text-slate-700">
                    מצב פעיל: {config.useSimulatedSheets ? 'הדמיית קופסה שחורה מקומית' : 'מסונכרן בזמן אמת לגוגל שיטס'}
                  </span>
                </div>
                {config.spreadsheetUrl ? (
                  <a
                    href={config.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#0369A1] font-bold flex items-center gap-1 hover:underline"
                  >
                    <span>פתח גליון אב בגוגל דרייב 🚀</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">טרם אומת קישור גיליון מקורי (יתנסה אוטומטית בהרצה הבאה)</span>
                )}
              </div>
            </div>
          </div>

          {/* Tab Selector & Logs Table */}
          <div className="bg-white border border-[#EAE0D5] rounded-3xl p-6 shadow-xs flex-1 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => fetchEnvAndLogs()}
                  disabled={loadingLogs}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                  title="רענן נתונים מגוגל"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                </button>
                <div className="text-right">
                  <h3 className="font-bold text-slate-800 text-sm">יומן תיעודים בקופסה</h3>
                  <p className="text-[10px] text-slate-400">לחיצה על קטגוריה תסנן את הפעולות הרלוונטיות</p>
                </div>
              </div>

              {/* Tabs list (Matches Apps Script tabs) */}
              <div className="flex gap-1 overflow-x-auto max-w-full pb-1">
                {(['כל', 'יומן', 'כונן', 'משימות', 'הסבר'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                      activeTab === tab 
                        ? 'bg-[#B2E2F2] text-[#0369A1] border-b-2' 
                        : 'bg-slate-100/70 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB: Setup Instructions & Code */}
            {activeTab === 'הסבר' ? (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-right text-xs leading-relaxed flex flex-col gap-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-800">הוראות התקנה לחיבור הקופסה השחורה (Google Apps Script)</h4>
                  <p className="text-slate-500 mt-1">בצעו את הצעדים הבאים כדי לחבר את גוגל דרייב, יומן, ומשימות שלכם לחלוטין!</p>
                </div>
                
                <ol className="list-decimal list-inside pr-2 flex flex-col gap-2.5 text-slate-700">
                  <li>היכנסו לפורטל הסקריפטים של גוגל: <a href="https://script.google.com" target="_blank" className="text-[#0369A1] font-bold hover:underline">script.google.com</a></li>
                  <li>לחצו על <b>"פרויקט חדש" (New Project)</b> בפינה השמאלית/ימנית עליונה.</li>
                  <li>מחקו לחלוטין את הקוד הזמני שמופיע בקובץ, והדביקו את קוד המקור המודפס מטה במלואו.</li>
                  <li>לחצו על הדיסקט <b>לשמור (Save)</b>.</li>
                  <li>לחצו על כפתור ה- <b>Deploy (פריסה)</b> ואז על <b>New Deployment (פריסה חדשה)</b>.</li>
                  <li>בחרו בגלגל השיניים הקטן ובחרו <b>Web App (אפליקציית אינטרנט)</b>.</li>
                  <li>תחת <b>Execute as</b> בחרו בחשבון הגוגל שלכם (Me).</li>
                  <li>תחת <b>Who has access</b> בחרו באופציה <b>Anyone (חיוני סנכרון!)</b>.</li>
                  <li>לחצו על Deploy, אשרו את הרשאות האפליקציה למייל שלכם, והעתיקו את הקישור שנוצר!</li>
                  <li>הדביקו את הקישור למעלה בתיבת ה-Webhook וסיימתם!</li>
                </ol>

                <div className="mt-2 text-right">
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-t-xl border border-slate-200">
                    <span className="font-mono text-[10px] text-slate-500">GoogleAppsScript.gs</span>
                    <button
                      onClick={copyScriptText}
                      className="text-xs bg-[#B2E2F2] text-slate-800 hover:bg-opacity-80 px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedScript ? "הועתק!" : "העתק את הקוד"}</span>
                    </button>
                  </div>
                  <pre className="bg-[#1e293b] text-slate-300 p-4 rounded-b-xl overflow-x-auto text-left font-mono text-[10px] max-h-60 leading-normal scrollbar-thin">
                    {googleAppsScriptCode}
                  </pre>
                </div>
              </div>
            ) : (
              /* TAB: Logs list representation */
              <div className="flex-1 overflow-x-auto">
                {/* Real-time Google Workspace Data Content Section */}
                {activeTab === 'יומן' && (
                  <div className="mb-6 bg-white p-4 rounded-2xl border border-[#EAE0D5] text-right">
                    <div className="flex justify-between items-center mb-3">
                      <button 
                        onClick={fetchCalendar}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 pr-1.5 pl-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingCalendar ? 'animate-spin' : ''}`} />
                        <span>רענן יומן</span>
                      </button>
                      <h4 className="font-bold text-xs text-indigo-950 border-r-4 border-indigo-500 pr-2">פגישות קרובות ביומן גוגל (שידור חי) 📅</h4>
                    </div>
                    {loadingCalendar ? (
                      <div className="py-6 text-center text-slate-400 font-mono text-xs">טוען אירועים מיומן גוגל...</div>
                    ) : calendarEvents.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs">אין פגישות קרובות ביומן החשבון</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                        {calendarEvents.map((ev: any) => (
                          <div key={ev.id} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 flex flex-col justify-between hover:bg-indigo-50 transition-all">
                            <div>
                              <h5 className="font-bold text-xs text-indigo-950 mb-1">{ev.summary}</h5>
                              {ev.description && <p className="text-[10px] text-slate-500 line-clamp-1 mb-1">{ev.description}</p>}
                              {ev.location && <p className="text-[9px] text-[#0369A1] font-medium mb-1">📍 {ev.location}</p>}
                              <span className="text-[9px] text-slate-400 font-mono block mt-1">
                                {new Date(ev.start).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            {ev.htmlLink && (
                              <a 
                                href={ev.htmlLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="mt-2 text-center text-[9px] font-bold bg-[#B2E2F2] hover:bg-opacity-80 text-[#0369A1] py-1 px-2 rounded-lg transition-all"
                              >
                                צפה ביומין 📅
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'כונן' && (
                  <div className="mb-6 bg-white p-4 rounded-2xl border border-[#EAE0D5] text-right">
                    <div className="flex justify-between items-center mb-3">
                      <button 
                        onClick={fetchDriveFiles}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 pr-1.5 pl-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingDrive ? 'animate-spin' : ''}`} />
                        <span>רענן כונן</span>
                      </button>
                      <h4 className="font-bold text-xs text-emerald-950 border-r-4 border-emerald-500 pr-2">קבצים ומסמכים אחרונים בגוגל דרייב 📁</h4>
                    </div>
                    {loadingDrive ? (
                      <div className="py-6 text-center text-slate-400 font-mono text-xs">טוען קבצים מכונן גוגל...</div>
                    ) : driveFiles.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs">אין קבצים בחשבון דרייב זה</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
                        {driveFiles.map((file: any) => (
                          <div key={file.id} className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 flex items-center justify-between hover:bg-emerald-50 transition-all gap-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-xs text-emerald-950 truncate">{file.name}</h5>
                              <p className="text-[9px] text-slate-400 mt-1">
                                עודכן: {new Date(file.modifiedTime).toLocaleDateString("he-IL")} {file.size ? `• ${file.size}` : ''}
                              </p>
                            </div>
                            {file.webViewLink && (
                              <a 
                                href={file.webViewLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="shrink-0 text-center text-[9px] font-bold bg-[#B2E2F2] hover:bg-opacity-80 text-[#0369A1] py-1.5 px-2.5 rounded-lg transition-all"
                              >
                                פתח קובץ 📂
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'משימות' && (
                  <div className="mb-6 bg-white p-4 rounded-2xl border border-[#EAE0D5] text-right">
                    <div className="flex justify-between items-center mb-3">
                      <button 
                        onClick={fetchGoogleTasks}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 pr-1.5 pl-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingTasks ? 'animate-spin' : ''}`} />
                        <span>רענן משימות</span>
                      </button>
                      <h4 className="font-bold text-xs text-pink-950 border-r-4 border-pink-500 pr-2">משימות פעילות בגוגל Tasks 📋</h4>
                    </div>

                    {/* Inline Task Creation Form Component */}
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!newTaskTitle.trim()) return;
                        setIsCreatingTask(true);
                        await createRealGoogleTask(newTaskTitle, newTaskNotes, newTaskPriority);
                        setNewTaskTitle("");
                        setNewTaskNotes("");
                        setNewTaskPriority("Medium");
                        setIsCreatingTask(false);
                      }}
                      className="mb-5 p-4 bg-pink-50/10 rounded-2xl border border-pink-100 flex flex-col gap-3 text-right"
                    >
                      <div className="text-[11px] font-bold text-pink-900 border-b border-pink-100/50 pb-1.5 flex items-center gap-1 select-none">
                        <span>➕ יצירת משימה חכמה עם רמת עדיפות (זמן אמת)</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">כותרת המשימה:</label>
                          <input 
                            type="text"
                            required
                            placeholder="לדוגמה: לבצע אינטגרציה מלאה לשרת"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            className="w-full text-xs p-2 rounded-xl border border-[#EAE0D5] bg-[#FAF9F6] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-pink-300 focus:ring-1 focus:ring-pink-300 transition-all text-right"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">רמת עדיפות המשימה:</label>
                          <div className="grid grid-cols-3 gap-1 bg-[#FAF9F6] p-1 rounded-xl border border-[#EAE0D5]">
                            <button
                              type="button"
                              onClick={() => setNewTaskPriority("High")}
                              className={`text-[10px] py-1 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none ${
                                newTaskPriority === 'High' 
                                  ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]' 
                                  : 'hover:bg-slate-50 text-slate-400'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              <span>גבוהה (High)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewTaskPriority("Medium")}
                              className={`text-[10px] py-1 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none ${
                                newTaskPriority === 'Medium' 
                                  ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]' 
                                  : 'hover:bg-slate-50 text-slate-400'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>בינונית (Med)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewTaskPriority("Low")}
                              className={`text-[10px] py-1 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 cursor-pointer select-none ${
                                newTaskPriority === 'Low' 
                                  ? 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]' 
                                  : 'hover:bg-slate-50 text-slate-400'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>נמוכה (Low)</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">הערות / פירוט נוסף:</label>
                        <textarea 
                          placeholder="תיאור המשימה, פרטים חשובים, סינכרון וכדומה..."
                          value={newTaskNotes}
                          onChange={(e) => setNewTaskNotes(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 rounded-xl border border-[#EAE0D5] bg-[#FAF9F6] text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-pink-300 focus:ring-1 focus:ring-pink-300 transition-all text-right resize-none"
                        />
                      </div>

                      <div className="flex justify-end mt-1">
                        <button
                          type="submit"
                          disabled={isCreatingTask || !newTaskTitle.trim()}
                          className="bg-pink-600 hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs px-4 py-2 rounded-xl border border-pink-700/30 shadow-xs transition-all cursor-pointer select-none"
                        >
                          {isCreatingTask ? 'רושם משימה...' : 'הוסף משימה כעת 📋'}
                        </button>
                      </div>
                    </form>

                    {loadingTasks ? (
                      <div className="py-6 text-center text-slate-400 font-mono text-xs">טוען משימות מגוגל...</div>
                    ) : googleTasks.length === 0 ? (
                      <div className="py-4 text-center text-slate-400 text-xs">אין משימות פעילות ברשימה זו</div>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                        {googleTasks.map((t: any) => (
                          <div key={t.id} className="p-2.5 bg-pink-50/20 rounded-xl border border-pink-100 flex items-center justify-between hover:bg-pink-50/45 transition-all gap-3">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                checked={t.status === 'completed'} 
                                readOnly 
                                className="w-3.5 h-3.5 accent-pink-600 rounded-sm cursor-pointer"
                              />
                              <div className="text-right">
                                <span className={`font-bold text-xs ${t.status === 'completed' ? 'line-through text-slate-400 font-normal' : 'text-pink-950'}`}>
                                  {t.title}
                                </span>
                                {t.notes && <p className="text-[10px] text-slate-500 mt-0.5 font-medium">{t.notes}</p>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0 select-none">
                              {/* Beautiful priority level badge */}
                              {t.priority === 'High' && (
                                <span className="text-[9px] bg-red-100/70 border border-red-200 text-red-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                  גבוה
                                </span>
                              )}
                              {t.priority === 'Medium' && (
                                <span className="text-[9px] bg-amber-100/70 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  בינוני
                                </span>
                              )}
                              {t.priority === 'Low' && (
                                <span className="text-[9px] bg-emerald-100/70 border border-emerald-200 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  נמוך
                                </span>
                              )}

                              {t.due && (
                                <span className="text-[8px] text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded-md font-mono">
                                  יעד: {new Date(t.due).toLocaleDateString("he-IL")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Section Header for black box logs */}
                <div className="mb-2 mr-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">קופסה שחורה - היסטוריית פעולות סנכרון:</span>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
                    <Database className="w-8 h-8 text-slate-300 stroke-1 mb-2" />
                    <p className="text-xs font-semibold">לא נמצאו ברשומות עדיין פעולות התואמות לסינון זה</p>
                    <p className="text-[10px] text-slate-400 mt-1">פנו לנועה בצ'אט או לחצו על הפעולות המהירות</p>
                  </div>
                ) : (
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#EAE0D5] text-slate-400">
                        <th className="py-2.5 px-3 font-semibold text-[11px]">כלי</th>
                        <th className="py-2.5 px-3 font-semibold text-[11px]">תיאור הפעולה שבוצעה</th>
                        <th className="py-2.5 px-3 font-semibold text-[11px]">מקום ביצוע</th>
                        <th className="py-2.5 px-3 font-semibold text-[11px]">זמן</th>
                        <th className="py-2.5 px-3 font-semibold text-[11px] text-center">סטטוס סנכרון</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr 
                          key={log.id} 
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                              log.toolName === 'יומן' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                              log.toolName === 'כונן' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              log.toolName === 'משימות' ? 'bg-pink-50 text-pink-700 border border-pink-100' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {log.toolName}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-700 min-w-[180px]">{log.description}</td>
                          <td className="py-3 px-3 text-slate-500 whitespace-nowrap max-w-[120px] truncate" title={log.location}>
                            {log.location}
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-mono whitespace-nowrap">{log.timestamp}</td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              log.syncStatus === 'סונכרן לגוגל שיטס' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${
                                log.syncStatus === 'סונכרן לגוגל שיטס' ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
                              }`}></span>
                              <span>{log.syncStatus}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Quick Actions Emulator Row */}
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#EAE0D5] flex flex-col gap-2.5 mt-auto">
              <h4 className="text-xs font-bold text-slate-700 text-right">קיצורי דרך לפעולות ישירות בחשבון גוגל (זמן אמת):</h4>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={createRealCalendarEvent}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold select-none flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  <span>יצירת פגישה ביומן</span>
                </button>
                <button
                  onClick={createRealGoogleTask}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold select-none flex items-center gap-1.5 cursor-pointer"
                >
                  <ListTodo className="w-3.5 h-3.5 text-pink-500" />
                  <span>הוספת משימה חדשה</span>
                </button>
                <button
                  onClick={createRealDriveFile}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold select-none flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  <span>יצירת קובץ בדרייב</span>
                </button>
                <button
                  onClick={() => {
                    triggerPushNotification("התראה מקומית דחופה 📱", "נועה מצאה חריגה של זמן! אל תשכחו את משימת בדיקת נושא האבטחה");
                    setToastMessage("התראת דחיפה נשלחה לסימולטור!");
                  }}
                  className="bg-amber-50 hover:bg-amber-100/70 text-amber-800 border border-amber-200 py-1.5 px-3 rounded-lg text-xs font-bold select-none flex items-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                  <span>בדיקת התראת Push</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Design */}
      <footer id="noa-global-footer" className="bg-white border-t border-[#EAE0D5] py-4 px-6 text-center text-xs text-slate-400 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="dir-rtl RTL text-right">אפליקציית נועה מתוכננת לנייד עם קופסה שחורה לתיעוד היסטוריית פעולות קריטיות.</p>
          <div className="flex items-center gap-1 text-slate-400">
            <span>מיוצר באהבה עבור שירותי מובייל ונאמני ענן קלאוד</span>
            <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
          </div>
        </div>
      </footer>
    </div>
  );
}
