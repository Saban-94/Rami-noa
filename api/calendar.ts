import { getCalendarClient } from './google-auth.js';

export default async function handler(req: any, res: any) {
  const method = req.method;

  try {
    const calendar = getCalendarClient();

    if (method === 'GET') {
      // List upcoming events
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 15,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = (response.data.items || []).map((item: any) => ({
        id: item.id,
        summary: item.summary || 'ללא כותרת',
        description: item.description || '',
        location: item.location || '',
        start: item.start?.dateTime || item.start?.date || '',
        end: item.end?.dateTime || item.end?.date || '',
        htmlLink: item.htmlLink || '',
        creator: item.creator?.email || ''
      }));

      return res.json({ success: true, events });
    } 
    
    if (method === 'POST') {
      const { summary, description, location, startTime, endTime } = req.body;

      if (!summary) {
        return res.status(400).json({ error: "כותרת הפגישה (summary) הינה שדה חובה" });
      }

      // Default times if missing (default start is current hour, default end is starting + 1 hour)
      let startIso = startTime;
      let endIso = endTime;

      if (!startIso) {
        const d = new Date();
        d.setMinutes(0, 0, 0); // round to top of hour
        startIso = d.toISOString();
      }
      if (!endIso) {
        const d = new Date(new Date(startIso).getTime() + 60 * 60 * 1000);
        endIso = d.toISOString();
      }

      const eventResource = {
        summary,
        description: description || 'נוצרה אוטומטית על ידי העוזרת נועה',
        location: location || '',
        start: {
          dateTime: startIso,
          timeZone: 'Asia/Jerusalem',
        },
        end: {
          dateTime: endIso,
          timeZone: 'Asia/Jerusalem',
        },
        reminders: {
          useDefault: true
        }
      };

      const result = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: eventResource,
      });

      return res.json({
        success: true,
        event: {
          id: result.data.id,
          summary: result.data.summary,
          description: result.data.description,
          location: result.data.location,
          start: result.data.start?.dateTime || result.data.start?.date || '',
          end: result.data.end?.dateTime || result.data.end?.date || '',
          htmlLink: result.data.htmlLink
        }
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });

  } catch (error: any) {
    console.error("Google Calendar API Error:", error);
    return res.status(500).json({
      error: "תקלה בתקשורת מול שרתי Google Calendar",
      details: error.message || String(error)
    });
  }
}
