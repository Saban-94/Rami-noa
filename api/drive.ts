import { getDriveClient } from './google-auth.js';

export default async function handler(req: any, res: any) {
  const method = req.method;

  try {
    const drive = getDriveClient();

    if (method === 'GET') {
      // List files/folders from Google Drive
      const response = await drive.files.list({
        pageSize: 20,
        fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)',
        orderBy: 'modifiedTime desc',
        q: "trashed = false",
      });

      const files = (response.data.files || []).map((file: any) => ({
        id: file.id,
        name: file.name || 'ללא שם',
        mimeType: file.mimeType || '',
        webViewLink: file.webViewLink || '',
        iconLink: file.iconLink || '',
        modifiedTime: file.modifiedTime || '',
        size: file.size ? `${(parseInt(file.size) / 1024).toFixed(1)} KB` : undefined
      }));

      return res.json({ success: true, files });
    }

    if (method === 'POST') {
      const { name, content, type } = req.body;

      if (!name) {
        return res.status(400).json({ error: "שם הקובץ או התיקייה (name) הינו שדה חובה" });
      }

      const isFolder = type === 'folder';
      
      const fileMetadata: any = {
        name,
        mimeType: isFolder ? 'application/vnd.google-apps.folder' : 'application/vnd.google-apps.document',
      };

      let media = undefined;
      
      if (!isFolder && content) {
        // If it's a file, we can upload it as plain text or HTML/Doc
        media = {
          mimeType: 'text/plain',
          body: content,
        };
        // Use normal text file or Google Doc depending on preference. Let's make it a Google Doc if un-specified
        fileMetadata.mimeType = 'application/vnd.google-apps.document'; 
      }

      const result = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, mimeType, webViewLink, iconLink',
      });

      // Try making the created item public so user can access it via webViewLink
      try {
        await drive.permissions.create({
          fileId: result.data.id!,
          requestBody: {
            role: 'reader',
            type: 'anyone',
          }
        });
      } catch (permError) {
        console.warn("Failed to set share permissions for newly created file:", permError);
        // Do not crash, proceed with outputting the result
      }

      // Re-fetch file to get fresh WebViewLink with permissions applied
      const freshFile = await drive.files.get({
        fileId: result.data.id!,
        fields: 'id, name, mimeType, webViewLink, iconLink',
      });

      return res.json({
        success: true,
        file: {
          id: freshFile.data.id,
          name: freshFile.data.name,
          mimeType: freshFile.data.mimeType,
          webViewLink: freshFile.data.webViewLink,
          iconLink: freshFile.data.iconLink,
        }
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${method} Not Allowed` });

  } catch (error: any) {
    console.error("Google Drive API Error:", error);
    return res.status(500).json({
      error: "תקלה בתקשורת מול שרתי Google Drive",
      details: error.message || String(error)
    });
  }
}
