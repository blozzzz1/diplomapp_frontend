import { supabase } from '../config/supabase';
import { User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export class AuthService {
  /** Публичный флаг с бэкенда; при сбое сети — не блокируем вход (регистрация уже прошла через Supabase). */
  static async isRegistrationOpen(): Promise<boolean> {
    try {
      const r = await fetch(`${API_BASE_URL}/api/settings/plan-config`);
      if (!r.ok) return true;
      const data = await r.json();
      return data.registrationEnabled !== false;
    } catch {
      return true;
    }
  }

  /** После входа / при старте приложения: бэкенд отклонит заблокированного (403 USER_BLOCKED). */
  static async verifySessionAllowed(): Promise<{ ok: boolean; error?: string }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: true };
    try {
      const r = await fetch(`${API_BASE_URL}/api/user/plan`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (r.status === 403) {
        const body = (await r.json().catch(() => ({}))) as { code?: string; error?: string };
        if (body.code === 'USER_BLOCKED') {
          await supabase.auth.signOut();
          const msg =
            typeof body.error === 'string' && body.error
              ? body.error
              : 'Аккаунт заблокирован. Обратитесь в поддержку.';
          return { ok: false, error: msg };
        }
      }
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  static async signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const allowed = await this.isRegistrationOpen();
      if (!allowed) {
        return { user: null, error: 'Регистрация временно отключена администратором.' };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, error: 'Failed to create user' };
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        createdAt: new Date(data.user.created_at),
      };

      return { user, error: null };
    } catch (error) {
      return { user: null, error: 'An unexpected error occurred' };
    }
  }

  static async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, error: 'Failed to sign in' };
      }

      const allowed = await this.verifySessionAllowed();
      if (!allowed.ok) {
        return { user: null, error: allowed.error || 'Аккаунт заблокирован.' };
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        createdAt: new Date(data.user.created_at),
      };

      return { user, error: null };
    } catch (error) {
      return { user: null, error: 'An unexpected error occurred' };
    }
  }

  static async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email!,
        createdAt: new Date(user.created_at),
      };
    } catch (error) {
      return null;
    }
  }

  static async deleteAccount(): Promise<{ error: string | null }> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { error: 'No user logged in' };
      }

      // Delete user account (this will cascade delete chat_sessions due to FK constraint)
      const { error } = await supabase.rpc('delete_user');
      
      if (error) {
        // If RPC function doesn't exist, try admin API (requires service role key)
        // For now, we'll just sign out and let admin handle deletion
        await this.signOut();
        return { error: 'Account deletion requested. Please contact support to complete the process.' };
      }

      return { error: null };
    } catch (error) {
      return { error: 'An unexpected error occurred' };
    }
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email!,
          createdAt: new Date(session.user.created_at),
        });
      } else {
        callback(null);
      }
    });
  }
}

