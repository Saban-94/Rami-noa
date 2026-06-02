import { getTasksClient } from './google-auth.js';

export default async function handler(req: any, res: any) {
  const method = req.method;

  try {
    const tasksClient = getTasksClient();

    if (method === 'GET') {
      // Fetch tasks from default task list
      const response = await tasksClient.tasks.list({
        tasklist: '@default',
        maxResults: 25,
        showCompleted: true,
        showHidden: true,
      });

      const tasks = (response.data.items || []).map((task: any) => {
        const notesStr = task.notes || '';
        let priority = 'Medium';
        let cleanNotes = notesStr;

        // Try parsing [Priority: High/Medium/Low] tag
        const priorityMatch = notesStr.match(/\[Priority:\s*(High|Medium|Low)\]/i);
        if (priorityMatch) {
          priority = priorityMatch[1];
          // Extrapolate and leave notes clean
          cleanNotes = notesStr.replace(/\[Priority:\s*(High|Medium|Low)\]\s*/gi, '').trim();
        } else {
          // Check Hebrew equivalents in case they were entered in Hebrew
          const hebrewMatch = notesStr.match(/עדיפות:\s*(גבוה|בינוני|נמוך)/i);
          if (hebrewMatch) {
            const val = hebrewMatch[1];
            if (val === 'גבוה') priority = 'High';
            else if (val === 'בינוני') priority = 'Medium';
            else if (val === 'נמוך') priority = 'Low';
            cleanNotes = notesStr.replace(/עדיפות:\s*(גבוה|בינוני|נמוך)\s*/gi, '').trim();
          }
        }

        return {
          id: task.id,
          title: task.title || 'משימה ללא שם',
          notes: cleanNotes,
          priority: priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase(), // Normalize to High, Medium, Low
          status: task.status || 'needsAction', // 'needsAction' or 'completed'
          due: task.due || '',
          completed: task.completed || ''
        };
      });

      return res.json({ success: true, tasks });
    }

    if (method === 'POST') {
      const { title, notes, due, priority } = req.body;

      if (!title) {
        return res.status(400).json({ error: "כותרת המשימה (title) הינה שדה חובה" });
      }

      // Embed selected priority level in the notes
      const finalPriority = priority || 'Medium';
      const notesPrefix = `[Priority: ${finalPriority}]`;
      const userNotes = notes || 'נוצרה אוטומטית על ידי העוזרת נועה';
      const finalNotes = `${notesPrefix}\n${userNotes}`;

      const taskResource: any = {
        title,
        notes: finalNotes,
      };

      if (due) {
        taskResource.due = due; // Must be RFC 3339 formatted date-time string
      }

      const result = await tasksClient.tasks.insert({
        tasklist: '@default',
        requestBody: taskResource,
      });

      return res.json({
        success: true,
        task: {
          id: result.data.id,
          title: result.data.title,
          notes: result.data.notes,
          status: result.data.status,
          due: result.data.due,
          completed: result.data.completed
        }
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });

  } catch (error: any) {
    console.error("Google Tasks API Error:", error);
    return res.status(500).json({
      error: "תקלה בתקשורת מול שרתי Google Tasks",
      details: error.message || String(error)
    });
  }
}
