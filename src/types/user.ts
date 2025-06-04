export type Role = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  role: Role;
  created_at: string;
  verified: boolean;
  savedProperties: string[];
  viewingHistory: string[];
}
