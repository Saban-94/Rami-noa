import { google } from 'googleapis';

export function getGoogleAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON variable is missing from the environment. Please configure it in your Secrets panel.");
  }

  let credentials;
  try {
    credentials = JSON.parse(saJson);
  } catch (err: any) {
    throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON. Please ensure it is valid JSON: " + err.message);
  }

  let privateKey = credentials.private_key;
  if (privateKey && typeof privateKey === "string") {
    // Correct escaping of newline characters in JSON-string private keys
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: privateKey,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/tasks'
    ]
  });

  return auth;
}

export function getCalendarClient() {
  const auth = getGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

export function getDriveClient() {
  const auth = getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

export function getTasksClient() {
  const auth = getGoogleAuth();
  return google.tasks({ version: 'v1', auth });
}
