import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from '../supabase-config';

export class AuthService {
  /**
   * Subscribe to auth state changes.
   * Returns an unsubscribe function (same contract as Firebase).
   */
  onAuthStateChanged(callback: (user: SupabaseAuthUser | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }

  async register(email: string, password: string): Promise<SupabaseAuthUser> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        throw new Error('This email is already registered. Please login instead.');
      }
      if (error.message.toLowerCase().includes('password')) {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error('Registration failed — no user returned.');
    return data.user;
  }

  async login(email: string, password: string): Promise<SupabaseAuthUser> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.toLowerCase().includes('invalid login')) {
        throw new Error('Invalid email or password. Please try again.');
      }
      if (error.message.toLowerCase().includes('rate')) {
        throw new Error('Too many failed login attempts. Please try again later.');
      }
      throw new Error(error.message);
    }
    if (!data.user) throw new Error('Login failed — no user returned.');
    return data.user;
  }

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw new Error(error.message);
    // Note: Google OAuth is redirect-based — the page will navigate away.
    // Supabase will restore the session on return via detectSessionInUrl.
  }

  async getCurrentUser(): Promise<SupabaseAuthUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
}
