import { supabase } from './client';

export const signUpWithEmail = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
};

export const signInWithEmail = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
};

export const signOut = async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};
