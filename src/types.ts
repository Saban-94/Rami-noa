export type ToolType = 'יומן' | 'כונן' | 'משימות' | 'כללי';

export interface ActionButton {
  id: string;
  text: string;
  type: 'link' | 'quick_reply' | 'action';
  payload: string; // Intent URL or text prompt
}

export interface Message {
  id: string;
  sender: 'user' | 'noa';
  text: string;
  timestamp: string;
  toolType?: ToolType;
  toolActionDetails?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  buttons?: ActionButton[];
}

export interface BlackBoxLog {
  id: string;
  timestamp: string;
  toolName: ToolType;
  description: string;
  location: string;
  status: 'פעיל' | 'נרשם בהצלחה' | 'נכשל';
  syncStatus: 'סונכרן לגוגל שיטס' | 'נשמר מקומית (קופסה שחורה)';
}

export interface SystemConfig {
  appsScriptUrl: string;
  useSimulatedSheets: boolean;
  spreadsheetUrl?: string;
}
