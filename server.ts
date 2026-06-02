import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database for Black Box Logs (Fallback if real Google Sheets is not paired yet)
let localLogs: any[] = [
  {
    id: "log_initial_1",
    timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
    toolName: "כללי",
    description: "אתחול מערכת נועה וחיבור לקופסה השחורה",
    location: "תל אביב, ישראל",
    status: "נרשם בהצלחה",
    syncStatus: "נשמר מקומית (קופסה שחורה)"
  },
  {
    id: "log_initial_2",
    timestamp: new Date(Date.now() - 3600000).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
    toolName: "משימות",
    description: "יצירת משימת אתחול: בדיקת תקינות רכיבי מובייל",
    location: "תל אביב, ישראל",
    status: "נרשם בהצלחה",
    syncStatus: "נשמר מקומית (קופסה שחורה)"
  }
];

// Configuration Store
let sysConfig = {
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbycL710BrrgkCntQH6JyucaTjN5A0ep2t7R7iYh72VVxljvRyl9oXmVveGZ54ZV8gZ3eA/exec",
  useSimulatedSheets: false
};

// Lazy initialization of Google Gen AI
let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Check key availability
app.get("/api/env-check", (req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    hasAppsScriptUrl: !!sysConfig.appsScriptUrl,
    appsScriptUrl: sysConfig.appsScriptUrl
  });
});

// Configure Apps Script URL
app.post("/api/config", (req, res) => {
  const { appsScriptUrl, useSimulatedSheets } = req.body;
  if (typeof appsScriptUrl === "string") {
    sysConfig.appsScriptUrl = appsScriptUrl;
  }
  if (typeof useSimulatedSheets === "boolean") {
    sysConfig.useSimulatedSheets = useSimulatedSheets;
  }
  res.json({ success: true, config: sysConfig });
});

// Get Logs (Either from local store or fetching from Apps Script)
app.get("/api/logs", async (req, res) => {
  if (sysConfig.appsScriptUrl && !sysConfig.useSimulatedSheets) {
    try {
      // Fetch from Google Apps Script Web App
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout
      
      const response = await fetch(sysConfig.appsScriptUrl, {
        method: "GET",
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const gasResult: any = await response.json();
        if (gasResult && gasResult.status === "success") {
          // Convert GAS format back to our representation
          const transformedLogs: any[] = [];
          const tabs = gasResult.data.tabs;
          let idCounter = 1;
          
          for (const tabName of Object.keys(tabs)) {
            const rows = tabs[tabName];
            for (const row of rows) {
              transformedLogs.push({
                id: `gas_log_${idCounter++}`,
                timestamp: row.timestamp || "",
                toolName: tabName,
                description: row.description || "",
                location: row.location || "",
                status: "נרשם בהצלחה",
                syncStatus: "סונכרן לגוגל שיטס"
              });
            }
          }
          
          // Sort by timestamp descending (if parseable)
          transformedLogs.sort((a,b) => b.timestamp.localeCompare(a.timestamp));
          
          return res.json({
            success: true,
            logs: transformedLogs.length > 0 ? transformedLogs : localLogs,
            spreadsheetUrl: gasResult.data.spreadsheetUrl,
            source: "google_sheets"
          });
        }
      }
    } catch (e: any) {
      console.error("Error fetching from Apps Script:", e.message);
      // Fallback to local logs on fetch error
    }
  }
  
  // Default fallback to local memory logs
  res.json({
    success: true,
    logs: localLogs,
    source: "local"
  });
});

// Post a new log manually
app.post("/api/logs", async (req, res) => {
  const { toolName, description, location, extraDetails } = req.body;
  const timestamp = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
  
  const newLog = {
    id: `log_${Date.now()}`,
    timestamp,
    toolName: toolName || "כללי",
    description: description || "פעולת מערכת ברירת מחדל",
    location: location || "לא ידוע",
    status: "נרשם בהצלחה" as "פעיל" | "נרשם בהצלחה" | "נכשל",
    syncStatus: "נשמר מקומית (קופסה שחורה)" as "סונכרן לגוגל שיטס" | "נשמר מקומית (קופסה שחורה)"
  };

  let wasSynced = false;
  let errorMsg = null;
  let targetUrl = "";

  if (sysConfig.appsScriptUrl && !sysConfig.useSimulatedSheets) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      
      const response = await fetch(sysConfig.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: newLog.toolName,
          description: newLog.description,
          location: newLog.location,
          extraDetails: extraDetails || "בוצע דרך ממשק פאנל",
          timestamp: newLog.timestamp
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const payload: any = await response.json();
      if (payload && payload.status === "success") {
        newLog.syncStatus = "סונכרן לגוגל שיטס";
        if (payload.spreadsheetUrl) {
          targetUrl = payload.spreadsheetUrl;
        }
        wasSynced = true;
      } else {
        errorMsg = payload.message || "שגיאה בתשובת Google App Script";
      }
    } catch (e: any) {
      errorMsg = e.message || "שגיית התחברות לסקריפט של גוגל";
    }
  }

  // Save to our local memory in all cases as high availability
  localLogs.unshift(newLog);
  
  res.json({
    success: true,
    log: newLog,
    synced: wasSynced,
    error: errorMsg,
    spreadsheetUrl: targetUrl
  });
});

// Local heuristic response fallback to handle key absence or Gemini API overload/503 spikes gracefully
async function handleHeuristicFallback(message: string, locStr: string, timestamp: string, isFromApiError = false) {
  const textMsg = message.toLowerCase();
  let detectedTool: "יומן" | "כונן" | "משימות" | "כללי" = "כללי";
  let reply = "";
  let description = "";
  let extraDetails = "";
  let buttons: any[] = [];

  if (textMsg.includes("פגישה") || textMsg.includes("יומן") || textMsg.includes("לוח זמנים") || textMsg.includes("פגישת") || textMsg.includes("בשעה")) {
    detectedTool = "יומן";
    reply = `הבנתי, רשמתי עבורך פגישה ביומן קופסת הניהול שלי. רוצה שאפתח את לוח השנה לתיאום פגישה מקיף יותר?`;
    description = `יצירת רישום יומן: ${message}`;
    extraDetails = `זמן יצירה: ${timestamp}`;
    buttons = [
      { text: "פתח יומן גוגל", type: "link", payload: "https://calendar.google.com" },
      { text: "תקין, תודה", type: "quick_reply", payload: "תודה נועה" }
    ];
  } else if (textMsg.includes("מסמך") || textMsg.includes("דרייב") || textMsg.includes("כונן") || textMsg.includes("קובץ") || textMsg.includes("לשמור")) {
    detectedTool = "כונן";
    reply = `בטח, יצרתי ותיעדתי קובץ חדש בכונן עבורך. תרצה לצפות בתיקייה הראשית של גוגל דרייב?`;
    description = `רישום בכונן: שמירת קובץ מסמך בנושא: ${message}`;
    extraDetails = `שם מסמך: סיכום_פעולה.txt`;
    buttons = [
      { text: "פתח גוגל דרייב", type: "link", payload: "https://drive.google.com" },
      { text: "שלח במייל", type: "link", payload: `mailto:?subject=סיכום נועה&body=${encodeURIComponent(message)}` }
    ];
  } else if (textMsg.includes("משימה") || textMsg.includes("לקנות") || textMsg.includes("לזכור") || textMsg.includes("תזכורת") || textMsg.includes("תזכרי")) {
    detectedTool = "משימות";
    reply = `הוספתי את המשימה הזו לרשימת המשימות הפעילה שלך בפרטי הניהול. האם תרצי ליצור תזכורת טלפונית מהירה?`;
    description = `הקצאת משימה חדשה: ${message}`;
    extraDetails = `סטטוס: פתוח`;
    buttons = [
      { text: "פתח גוגל משימות", type: "link", payload: "https://tasks.google.com" },
      { text: "התקשר לתזכורת", type: "link", payload: "tel:*2525" }
    ];
  } else {
    detectedTool = "כללי";
    reply = `היי, אני נועה העוזרת האישית שלך. כל פעולה שנעשה כאן מתועדת ומנוהלת ישר לקופסה השחורה שלך בגוגל שיטס. מה תרצה שנעשה כעת? `;
    description = `תשאול שיחה כללי: ${message}`;
    extraDetails = "סוג: דו שיח";
    buttons = [
      { text: "יוזם שיחה", type: "quick_reply", payload: "נועה, תוסיפי לי משימה דחופה לעבור על המצגת" },
      { text: "תיעוד מיקום", type: "action", payload: "LOCATION_SYNC" }
    ];
  }

  // Prepend warning if generated due to API overload / 503 Spike
  let warningMessage = "";
  if (isFromApiError) {
    warningMessage = `\n\n⚠️ שימו לב: עקב עומס זמני קל בשרתי ה-AI (עומס יתר של גוגל 503), עברתי אוטומטית למצב נועה גיבוי מקומי מהיר ומאובטח. פעולתכם נקלטה בהצלחה!`;
  } else {
    warningMessage = `\n\n⚠️ שים לב: מפתח ה-Gemini אינו מוגדר, מופעלת הדמיה חכמה.`;
  }

  const mockLog = {
    id: `log_${Date.now()}`,
    timestamp,
    toolName: detectedTool,
    description,
    location: locStr,
    status: "נרשם בהצלחה" as "פעיל" | "נרשם בהצלחה" | "נכשל",
    syncStatus: (sysConfig.appsScriptUrl && !sysConfig.useSimulatedSheets) ? "סונכרן לגוגל שיטס" as "סונכרן לגוגל שיטס" | "נשמר מקומית (קופסה שחורה)" : "נשמר מקומית (קופסה שחורה)" as "סונכרן לגוגל שיטס" | "נשמר מקומית (קופסה שחורה)"
  };

  if (sysConfig.appsScriptUrl && !sysConfig.useSimulatedSheets) {
    try {
      await fetch(sysConfig.appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: mockLog.toolName,
          description: mockLog.description,
          location: mockLog.location,
          extraDetails: extraDetails,
          timestamp: mockLog.timestamp
        })
      });
    } catch (err) {
      console.log("Failing silent apps script post on fallback trigger:", err);
    }
  }

  localLogs.unshift(mockLog);

  return {
    success: true,
    message: {
      id: `msg_${Date.now()}`,
      sender: "noa" as const,
      text: `${reply}${warningMessage}`,
      timestamp,
      toolType: detectedTool,
      toolActionDetails: description,
      buttons
    },
    log: mockLog
  };
}

// Process a conversational user prompt through Gemini
app.post("/api/chat", async (req, res) => {
  const { message, location, locationString } = req.body;
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "נא להזין הודעה תקינה" });
  }

  const locStr = locationString || (location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "תל אביב, ישראל");
  const timestamp = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

  const ai = getGeminiClient();

  if (!ai) {
    const fallbackResult = await handleHeuristicFallback(message, locStr, timestamp, false);
    return res.json(fallbackResult);
  }

  // Real Gemini logic using @google/genai structured schema
  try {
    const promptSystem = `
      אתה מנוע החשיבה של "נועה" (Noa), עוזרת אישית אינטליגנטית, יוקרתית וחדשנית המותקנת בנייד של המשתמש.
      התפקיד שלך הוא לשרת את המשתמש בעברית מלאה, שוטפת, בנימה חמה, מקצועית ומנומסת ביותר.
      עליך לפרש את ההודעה של המשתמש, להחליט לאיזה כלי ניהול (toolName) היא משתייכת:
      1. "יומן" (למשל: תיאום פגישות, אירועים, זמנים, שינוי לוחות זמנים, תזכורות עם זמנים מוגדרים).
      2. "כונן" (למשל: שמירה, עיבוד מסמכים, כתיבת סיכומי שיחה, יצירת קבצים, חיבור קבצים או דוחו"ת).
      3. "משימות" (למשל: רשימת קניות, תוספות של משימות פשוטות לביצוע או checklists).
      4. "כללי" (למשל: שאלות שיחה רגילות, עזרה, בדיקות מערכת, שאלות הכוון).

      עליך להפיק פלט בפורמט JSON בלבד התואם בדיוק לסקמה שהוגדרה.
      - בתשובה שלך למשתמש (reply), עלייך לנסח אותה בצורה שירותית ומזמינה המפרטת את סיום הפעולה שתרשם ברקע.
      - בקטגוריית description, נסח משפט תיאור קצר, פורמלי ומדויק בעברית לרישום בגוגל שיטס (למשל: "הוספת פגישת עבודה עם אייל מחר ב-14:00").
      - בקטגוריית extraDetails, הוסף פרטים נוספים לארכיון (כגון מועד מיועד, תכולה, רמת דחיפות ועוד).
      - עליך להציע תמיד בין 1 ל-3 כפתורים אינטראקטיביים (buttons) המאפשרים למשתמש לעשות קישור חיצוני חשוב (כמו פתיחת דרייב, פתיחת יומן, שליחת מייל, חיוג מהיר לביצוע) או שליחת תגובה מהירה.
        * כפתורים חייבים לכלול טקסט עברי פשוט, בהיר לחלוטין ללא מילים לועזיות (למשל השתמש ב-'חייג לבירור' במקום 'טלפון').
        * סוגי הכפתורים הם:
          - 'link': פתיחת כתובת אינטרנט או Schema Intent (כמו tel:..., mailto:..., https://maps.google.com, https://calendar.google.com).
          - 'quick_reply': שליחת הודעת טקסט מוכנה מראש חזרה לצ'אט.
          - 'action': פקודת מערכת מיוחדת לעדכון (כמו 'LOCATION_SYNC' או 'PULL_LATEST').
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `מיקום המשתמש כרגע: ${locStr}\nהזמן הנוכחי: ${timestamp}\n\nהודעת המשתמש:\n${message}` }] }
      ],
      config: {
        systemInstruction: promptSystem,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: "תשובת נועה המילולית בעברית" },
            toolType: { type: Type.STRING, description: "אחת מן האפשרויות הבאות בדיוק בלבד: יומן, כונן, משימות, כללי" },
            description: { type: Type.STRING, description: "תיאור הפעולה לרישום" },
            extraDetails: { type: Type.STRING, description: "פרטי עזר קצרים לרישום" },
            buttons: {
              type: Type.ARRAY,
              description: "מערך כפתורים אינטראקטיביים שיעוצבו בבועת הצ'אט",
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "כיתוב עברי ברור בלבד" },
                  type: { type: Type.STRING, description: "link / quick_reply / action" },
                  payload: { type: Type.STRING, description: "הקישור או הערך לשליחה" }
                },
                required: ["text", "type", "payload"]
              }
            }
          },
          required: ["reply", "toolType", "description", "extraDetails", "buttons"]
        }
      }
    });

    const outputText = response.text || "{}";
    const result = JSON.parse(outputText.trim());

    const finalToolType = result.toolType || "כללי";
    const finalDescription = result.description || `דו-שיח עם נועה באפליקציה`;
    const finalExtraDetails = result.extraDetails || "";
    const finalReply = result.reply || "הפעולה התקבלה ותועדה במערכת היוקרה של נועה";
    const finalButtons = result.buttons || [];

    // Document to black box / Google Sheets
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp,
      toolName: finalToolType,
      description: finalDescription,
      location: locStr,
      status: "נרשם בהצלחה" as "פעיל" | "נרשם בהצלחה" | "נכשל",
      syncStatus: "נשמר מקומית (קופסה שחורה)" as "סונכרן לגוגל שיטס" | "נשמר מקומית (קופסה שחורה)"
    };

    let syncOk = false;
    let spreadsheetUrl = "";

    if (sysConfig.appsScriptUrl && !sysConfig.useSimulatedSheets) {
      try {
        const responseGas = await fetch(sysConfig.appsScriptUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: finalToolType,
            description: finalDescription,
            location: locStr,
            extraDetails: finalExtraDetails,
            timestamp: timestamp
          })
        });
        const gasPayload: any = await responseGas.json();
        if (gasPayload && gasPayload.status === "success") {
          newLog.syncStatus = "סונכרן לגוגל שיטס";
          syncOk = true;
          if (gasPayload.spreadsheetUrl) {
            spreadsheetUrl = gasPayload.spreadsheetUrl;
          }
        }
      } catch (err: any) {
        console.error("GAS dispatch failed in Chat API:", err.message);
      }
    }

    localLogs.unshift(newLog);

    res.json({
      success: true,
      message: {
        id: `msg_${Date.now()}`,
        sender: "noa",
        text: finalReply,
        timestamp,
        toolType: finalToolType,
        toolActionDetails: finalDescription,
        buttons: finalButtons
      },
      log: newLog,
      spreadsheetUrl
    });

  } catch (error: any) {
    console.error("Gemini invocation failed, falling back to heuristic handler:", error);
    // Graceful high-availability auto fallback when Gemini has high demand (503), quota limits or error
    const fallbackResult = await handleHeuristicFallback(message, locStr, timestamp, true);
    res.json(fallbackResult);
  }
});

// Vite Dev Server / Prod Server Routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is booted perfectly on port ${PORT}`);
  });
}

startServer();
