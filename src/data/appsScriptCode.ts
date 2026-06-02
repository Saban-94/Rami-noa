export const googleAppsScriptCode = `/**
 * קופסה שחורה עבור אפליקציית נועה
 * --------------------------------
 * קוד גוגל אפס סקריפט (Google Apps Script) לניהול ותיעוד דו-כיווני מלא.
 * 
 * קוד זה יוצר קובץ גליון חדש בשם "נועה - קופסה שחורה" אם אינו קיים,
 * פותח בו גיליונות (טאבים) נפרדים לכל כלי (יומן, כונן, משימות, כללי),
 * ומתעד את כל הפעולות עם שעה, מיקום ופרטים מלאים.
 * 
 * הוראות התקנה:
 * 1. היכנסו ל- https://script.google.com
 * 2. לחצו על "פרויקט חדש" (New Project).
 * 3. מחקו את הקוד הקיים והדביקו את קוד זה במקומו.
 * 4. לחצו על כפתור השמירה (אייקון של דיסקט).
 * 5. לחצו על "פריסה" -> "פריסה חדשה" (Deploy -> New deployment).
 * 6. בחרו סוג פריסה: "אפליקציית אינטרנט" (Web app).
 * 7. הגדירו:
 *    - Execute as: Me (הגדרת החשבון שלכם)
 *    - Who has access: Anyone (חיוני כדי לאפשר לאפליקציה לשלוח נתונים)
 * 8. לחצו על Deploy ואשרו הרשאות גישה לחשבון הגוגל שלכם.
 * 9. העתיקו את ה- Web App URL והדביקו אותו בהגדרות של אפליקציית נועה.
 */

// שם קובץ הגליון הראשי
const SPREADSHEET_NAME = "נועה - קופסה שחורה";

// שמות הטאבים השונים
const TABS = {
  CALENDAR: "יומן",
  DRIVE: "כונן",
  TASKS: "משימות",
  GENERAL: "כללי"
};

/**
 * נקודת כניסה לפניות POST - תיעוד פעולה חדשה
 */
function doPost(e) {
  try {
    var payloadData = JSON.parse(e.postData.contents);
    
    // קבלת או יצירת הגליון
    var ss = getOrCreateSpreadsheet();
    var sheet = getOrCreateTab(ss, payloadData.toolName || TABS.GENERAL);
    
    var timestamp = payloadData.timestamp || new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" });
    var description = payloadData.description || "";
    var location = payloadData.location || "לא צוין מיקום";
    var extraDetails = payloadData.extraDetails || "";
    
    // הוספת השורה החדשה לגליון המתאים
    sheet.appendRow([
      timestamp,
      description,
      location,
      extraDetails,
      "דרך אפליקציית נועה"
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "הפעולה תועדה בהצלחה בקופסה השחורה",
      spreadsheetUrl: ss.getUrl(),
      spreadsheetId: ss.getId(),
      tabName: sheet.getName()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * נקודת כניסה לפניות GET - שליפת הנתונים האחרונים לסינכרון דו-כיווני
 */
function doGet(e) {
  try {
    var ss = getOrCreateSpreadsheet();
    var result = {
      spreadsheetUrl: ss.getUrl(),
      tabs: {}
    };
    
    // שליפת הנתונים מכל טאב
    for (var key in TABS) {
      var tabName = TABS[key];
      var sheet = getOrCreateTab(ss, tabName);
      var values = sheet.getDataRange().getValues();
      var rows = [];
      
      // דילוג על שורת הכותרת
      for (var i = 1; i < values.length; i++) {
        rows.push({
          timestamp: values[i][0],
          description: values[i][1],
          location: values[i][2],
          extraDetails: values[i][3]
        });
      }
      result.tabs[tabName] = rows;
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      data: result
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * מוצא את הקובץ הקיים או מייצר קובץ גוגל שיטס חדש תחת השם המבוקש
 */
function getOrCreateSpreadsheet() {
  var files = DriveApp.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.open(file);
  } else {
    var ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    // אתחול טאבים ברירת מחדל
    for (var key in TABS) {
      getOrCreateTab(ss, TABS[key]);
    }
    // מחיקת הגיליון "Sheet1" שנוצר אוטומטית אם יש אחרים
    var defaultSheet = ss.getSheetByName("Sheet1");
    if (defaultSheet) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch(e) {}
    }
    return ss;
  }
}

/**
 * מוצא טאב קיים או יוצר טאב חדש עם כותרות מתאימות
 */
function getOrCreateTab(spreadsheet, tabName) {
  var sheet = spreadsheet.getSheetByName(tabName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(tabName);
    
    // עיצוב כותרות הגיליון
    var headers = ["זמן פעולה", "תיאור הפעולה", "מיקום", "פרטים נוספים", "מקור"];
    sheet.appendRow(headers);
    
    // הדגשת כותרות
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold");
    range.setBackground("#E0F2FE"); // תכלת עדין התואם לעיצוב נועה
    range.setFontColor("#0369A1");
    range.setHorizontalAlignment("center");
    
    // הקפאת שורת כותרת
    sheet.setFrozenRows(1);
    
    // התאמת רוחב עמודות אוטומטית
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}
`;
