export type Role = 'user' | 'admin' | 'agent';


export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneVerified?: boolean;   // optional — not all auth providers supply this
  role: Role;
  created_at: string;
  verified: boolean;
  savedProperties: string[];
  viewingHistory: string[];
}
