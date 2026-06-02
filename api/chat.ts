import { GoogleGenAI, Type } from "@google/genai";
import { getCalendarClient, getDriveClient, getTasksClient } from './google-auth.js';

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  const { message, location, locationString, userEmail } = req.body;
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "נא להזין הודעה תקינה" });
  }

  const locStr = locationString || (location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : "תל אביב, ישראל");
  const timestamp = new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      error: "מפתח ה-Gemini אינו מוגדר בשרת. נא להגדיר GEMINI_API_KEY במערכת.",
      success: false
    });
  }

  try {
    const promptSystem = `
      אתה מנוע החשיבה של "נועה" (Noa), עוזרת אישית אינטליגנטית, יוקרתית וחדשנית המותקנת בנייד של המשתמש ומחוברת ישירות לחשבון הגוגל שלו.
      התפקיד שלך הוא לשרת את המשתמש בעברית מלאה, שוטפת, בנימה חמה ומקצועית ביותר.

      עליך לפרש את ההודעה של המשתמש ולהחליט האם היא מצריכה הפעלה של אחד מכליי גוגל הבאים:
      - יומן (Google Calendar): יצירת פגישות, זמנים.
      - כונן (Google Drive): יצירת קבצים, מסמכים או תיקיות.
      - משימות (Google Tasks): הוספת משימה או checklist לביצוע.
      - כללי (ללא כלי ספציפי): לדו-שיח כללי, מענה לשאלות או הסברים.

      עליך להפיק פלט בפורמט JSON בלבד התואם בדיוק לסקמה שהוגדרה.
      - בתשובה שלך למשתמש (reply), נסח אותה בצורה שירותית המפרטת שביצעת את הפעולה באמת בחשבון הגוגל שלו.
      - תחת toolCall, ציין את שם הכלי (calendar / drive / tasks / none) ואת ה-method לפעולה אמיתית.
      - תחת parameters, חלץ את השדות הנדרשים מההודעה בצורה מדויקת:
        * ליצירת פגישה: summary (כותרת), description (פירוט), startTime (בפורמט ISO 8601, נסה להסיק יחסית לזמן הנוכחי שסופק), endTime (בפורמט ISO 8601).
        * ליצירת קובץ בכונן: name (שם הקובץ/תיקייה), content (תוכן הקובץ - חבר סיכום קצר או תוכן מתאים אם המשתמש ביקש לשמור משהו), type (קובץ 'file' או תיקייה 'folder').
        * ליצירת משימה: title (כותרת המשימה), notes (פירוט המשימה במידה ויש), priority (רמת עדיפות: High, Medium, Low בהתאם לרמת הקריטיות שמשתמעת מההודעה), category (קטגוריית משימה: Work, Personal, Shopping או Other בהתאם לתוכן המשימה).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          role: "user",
          parts: [{
            text: `מיקום המשתמש כרגע: ${locStr}\nהזמן הנוכחי בשרת (שעון ירושלים): ${timestamp}\nאימייל המשתמש: ${userEmail || "לא ידוע"}\n\nהודעת המשתמש:\n${message}`
          }]
        }
      ],
      config: {
        systemInstruction: promptSystem,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: "תשובת נועה המילולית המעדכנת על ביצוע הפעולה" },
            toolType: { type: Type.STRING, description: "אחת מן האפשרויות הבאות בדיוק בלבד: יומן, כונן, משימות, כללי" },
            description: { type: Type.STRING, description: "תיאור הפעולה שבוצעה לרישום" },
            extraDetails: { type: Type.STRING, description: "פרטים תמציתיים נוספים לרישום" },
            toolCall: {
              type: Type.OBJECT,
              description: "קריאה לפונקציית צד-שרת אמיתית מול גוגל",
              properties: {
                api: { type: Type.STRING, description: "calendar / drive / tasks / none" },
                method: { type: Type.STRING, description: "create_event / create_file / create_task / none" },
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    summary: { type: Type.STRING },
                    description: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    name: { type: Type.STRING },
                    content: { type: Type.STRING },
                    type: { type: Type.STRING, description: "file / folder" },
                    title: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    priority: { type: Type.STRING, description: "עבור משימות: רמת עדיפות (High, Medium, Low). נתח וקבע לפי מידת הדחיפות." },
                    category: { type: Type.STRING, description: "עבור משימות: קטגוריית משימה (Work, Personal, Shopping, Other). נתח וקבע לפי תוכן המשימה." }
                  }
                }
              },
              required: ["api", "method", "parameters"]
            }
          },
          required: ["reply", "toolType", "description", "extraDetails", "toolCall"]
        }
      }
    });

    const outputText = response.text || "{}";
    const aiResult = JSON.parse(outputText.trim());

    let finalReply = aiResult.reply;
    let finalToolType = aiResult.toolType || "כללי";
    let finalDescription = aiResult.description || "שיחת מערכת";
    const finalExtraDetails = aiResult.extraDetails || "";
    const toolCall = aiResult.toolCall;

    let buttons: any[] = [];
    let executeSuccess = true;
    let apiResponseData: any = null;

    // Execute real Google API actions if requested by the AI
    if (toolCall && toolCall.api !== 'none' && toolCall.method !== 'none') {
      const params = toolCall.parameters || {};

      try {
        if (toolCall.api === 'calendar' && toolCall.method === 'create_event') {
          const calendar = getCalendarClient();
          const startIso = params.startTime || new Date().toISOString();
          const endIso = params.endTime || new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

          const result = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
              summary: params.summary || 'פגישה חדשה',
              description: params.description || 'תיעוד על ידי העוזרת האישית נועה',
              start: { dateTime: startIso, timeZone: 'Asia/Jerusalem' },
              end: { dateTime: endIso, timeZone: 'Asia/Jerusalem' }
            }
          });

          apiResponseData = result.data;
          finalDescription = `פגישה נוצרה ביומן: ${result.data.summary}`;
          
          if (result.data.htmlLink) {
            buttons.push({
              text: "פתח ביומן גוגל 📅",
              type: "link",
              payload: result.data.htmlLink
            });
          }
        } 
        
        else if (toolCall.api === 'drive' && toolCall.method === 'create_file') {
          const drive = getDriveClient();
          const isFolder = params.type === 'folder';

          const fileMetadata: any = {
            name: params.name || 'קובץ חדש',
            mimeType: isFolder ? 'application/vnd.google-apps.folder' : 'application/vnd.google-apps.document',
          };

          let media = undefined;
          if (!isFolder) {
            media = {
              mimeType: 'text/plain',
              body: params.content || 'סיכום נרשם על ידי נועה'
            };
          }

          const result = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, mimeType, webViewLink'
          });

          // Share reader access link so user can open instantly
          try {
            await drive.permissions.create({
              fileId: result.data.id!,
              requestBody: { role: 'reader', type: 'anyone' }
            });
          } catch (_) {}

          // Get fresh metadata viewlink
          const fresh = await drive.files.get({
            fileId: result.data.id!,
            fields: 'id, name, mimeType, webViewLink'
          });

          apiResponseData = fresh.data;
          finalDescription = `קובץ נוצר בכונן: ${fresh.data.name}`;

          if (fresh.data.webViewLink) {
            buttons.push({
              text: isFolder ? "פתח תיקייה בכונן 📁" : "פתח מסמך בכונן 📄",
              type: "link",
              payload: fresh.data.webViewLink
            });
          }
        } 
        
        else if (toolCall.api === 'tasks' && toolCall.method === 'create_task') {
          const tasksClient = getTasksClient();
          const finalPriority = params.priority || 'Medium';
          const finalCategory = params.category || 'Other';
          const notesPrefix = `[Priority: ${finalPriority}] [Category: ${finalCategory}]`;
          const finalNotes = `${notesPrefix}\n${params.notes || 'נוצרה על ידי העוזרת נועה'}`;

          const result = await tasksClient.tasks.insert({
            tasklist: '@default',
            requestBody: {
              title: params.title || 'משימה חדשה',
              notes: finalNotes,
            }
          });

          apiResponseData = result.data;
          finalDescription = `משימה נוספה: ${result.data.title}`;
          
          buttons.push({
            text: "פתח משימות גוגל 📋",
            type: "link",
            payload: "https://tasks.google.com"
          });
        }
      } catch (authErr: any) {
        console.error(`Google API execute failure [${toolCall.api}]:`, authErr);
        executeSuccess = false;
        finalReply = `${finalReply}\n\n(נרשמה תקלה בעת ביצוע הפעולה בענן: ${authErr.message || "אימות גוגל נכשל"})`;
      }
    }

    // Default button fallback if none created
    if (buttons.length === 0) {
      if (finalToolType === 'יומן') {
        buttons.push({ text: "לוח השנה 📅", type: "link", payload: "https://calendar.google.com" });
      } else if (finalToolType === 'כונן') {
        buttons.push({ text: "גוגל דרייב 📁", type: "link", payload: "https://drive.google.com" });
      } else if (finalToolType === 'משימות') {
        buttons.push({ text: "ניהול משימות 📋", type: "link", payload: "https://tasks.google.com" });
      } else {
        buttons.push({ text: "תיעוד מיקום 📍", type: "action", payload: "LOCATION_SYNC" });
      }
    }

    // Prepare response log
    const realLog = {
      id: `log_${Date.now()}`,
      timestamp,
      toolName: finalToolType,
      description: finalDescription,
      location: locStr,
      status: (executeSuccess ? "נרשם בהצלחה" : "נכשל") as "פעיל" | "נרשם בהצלחה" | "נכשל",
      syncStatus: "סונכרן לגוגל שיטס" as "סונכרן לגוגל שיטס" | "נשמר מקומית (קופסה שחורה)"
    };

    return res.json({
      success: true,
      message: {
        id: `msg_${Date.now()}`,
        sender: "noa",
        text: finalReply,
        timestamp,
        toolType: finalToolType,
        toolActionDetails: finalDescription,
        buttons: buttons
      },
      log: realLog
    });

  } catch (error: any) {
    console.error("Gemini + Real Google APIs invocation failed:", error);
    return res.status(500).json({
      error: "שגיאה בעיבוד הבקשה שלך מול השרת של נועה",
      details: error.message || String(error)
    });
  }
}
