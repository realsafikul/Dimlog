import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  updateProfile 
} from 'firebase/auth';
import { auth, googleProvider, createSecondaryAuth, getStoredApiKey, saveStoredApiKey } from '../firebase.js';
import { 
  UserProfile, 
  UserRole, 
  LogEntry 
} from '../types';
import { 
  SUPER_ADMIN_EMAIL, 
  subscribeToUserProfile, 
  ensureSuperAdminProfile, 
  createPendingUserProfile,
  adminApproveUser
} from '../services/firestore';
import { ref, set } from 'firebase/database';
import { db } from '../firebase.js';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loadingAuth: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  userRole: UserRole;
  canCreate: boolean;
  isApiKeyConfigured: boolean;
  canEditEntry: (entry: LogEntry) => boolean;
  canDeleteEntry: (entry: LogEntry) => boolean;
  loginWithUsername: (username: string, pass: string) => Promise<void>;
  signupWithUsername: (username: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  adminCreateUser: (username: string, pass: string, role: UserRole) => Promise<void>;
  updateApiKey: (key: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const cleanUsername = (raw: string) => {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
};

export const makeVirtualEmail = (username: string) => {
  return `${cleanUsername(username)}@dimlog.app`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey);

  const isApiKeyConfigured = useMemo(() => {
    return apiKey.trim().length > 0 && !!auth;
  }, [apiKey]);

  // Monitor auth state changes
  useEffect(() => {
    if (!auth) {
      setLoadingAuth(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        setCurrentUser(user);

        if (user) {
          // If super admin email, auto ensure admin permissions
          if (user.email === SUPER_ADMIN_EMAIL) {
            await ensureSuperAdminProfile({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
            });
          }

          // Real-time listener for current user's profile
          const unsubProfile = subscribeToUserProfile(
            user.uid,
            (profile) => {
              setUserProfile(profile);
              setLoadingAuth(false);
            },
            (err) => {
              console.error('[Auth Error] Profile listener error:', err);
              setLoadingAuth(false);
            }
          );

          return () => unsubProfile();
        } else {
          setUserProfile(null);
          setLoadingAuth(false);
        }
      },
      (error) => {
        console.error('[Auth Error] onAuthStateChanged error:', error);
        setLoadingAuth(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Compute permission flags
  const isAdmin = useMemo(() => {
    return currentUser?.email === SUPER_ADMIN_EMAIL;
  }, [currentUser]);

  const isApproved = useMemo(() => {
    if (isAdmin) return true;
    return userProfile?.status === 'approved';
  }, [isAdmin, userProfile]);

  const userRole: UserRole = useMemo(() => {
    if (isAdmin) return 'full';
    if (!isApproved) return 'none';
    return userProfile?.role || 'none';
  }, [isAdmin, isApproved, userProfile]);

  const canCreate = useMemo(() => {
    if (isAdmin) return true;
    if (!isApproved) return false;
    return userRole === 'editor' || userRole === 'full';
  }, [isAdmin, isApproved, userRole]);

  const canEditEntry = (entry: LogEntry): boolean => {
    if (isAdmin) return true;
    if (!isApproved) return false;
    if (userRole === 'full') return true;
    if (userRole === 'editor') {
      // Editors can edit ONLY what they created themselves.
      // Legacy records without createdBy can only be edited by admin!
      return !!entry.createdBy && entry.createdBy === currentUser?.uid;
    }
    return false;
  };

  const canDeleteEntry = (entry: LogEntry): boolean => {
    if (isAdmin) return true;
    if (!isApproved) return false;
    if (userRole === 'full') return true;
    if (userRole === 'editor') {
      // Editors can delete ONLY what they created themselves.
      // Legacy records without createdBy can only be edited by admin!
      return !!entry.createdBy && entry.createdBy === currentUser?.uid;
    }
    return false;
  };

  // Sign in with username + password
  const loginWithUsername = async (username: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase Web API Key is missing. Please enter your Firebase API key in the field below or configure VITE_FIREBASE_API_KEY in Netlify.');
    }
    const cleaned = cleanUsername(username);
    if (!cleaned) throw new Error('Please enter a valid username (letters, numbers, underscore).');
    if (!pass || pass.length < 6) throw new Error('Password must be at least 6 characters.');

    const virtualEmail = makeVirtualEmail(cleaned);
    try {
      await signInWithEmailAndPassword(auth, virtualEmail, pass);
    } catch (err: any) {
      console.error('[Auth Error] loginWithUsername failed:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        throw new Error('Invalid username or password.');
      }
      throw err;
    }
  };

  // Request Access / Sign up with username + password
  const signupWithUsername = async (username: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase Web API Key is missing. Please enter your Firebase API key in the field below or configure VITE_FIREBASE_API_KEY in Netlify.');
    }
    const cleaned = cleanUsername(username);
    if (!cleaned || cleaned.length < 3) {
      throw new Error('Username must be at least 3 characters (letters, numbers, underscore).');
    }
    if (!pass || pass.length < 6) {
      throw new Error('Password must be at least 6 characters long (Firebase requirement).');
    }

    const virtualEmail = makeVirtualEmail(cleaned);
    try {
      const cred = await createUserWithEmailAndPassword(auth, virtualEmail, pass);
      await updateProfile(cred.user, { displayName: cleaned });

      // Create record at users/{uid} with status "pending" and role "none"
      await createPendingUserProfile({
        uid: cred.user.uid,
        username: cleaned,
        email: virtualEmail,
      });
    } catch (err: any) {
      console.error('[Auth Error] signupWithUsername failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('This username is already taken. Please choose another username.');
      }
      throw err;
    }
  };

  // Super Admin sign in with Google
  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase Web API Key is missing. Please enter your Firebase Web API Key in the field below or configure VITE_FIREBASE_API_KEY in Netlify.');
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user.email === SUPER_ADMIN_EMAIL) {
        await ensureSuperAdminProfile({
          uid: res.user.uid,
          email: res.user.email,
          displayName: res.user.displayName,
        });
      }
    } catch (err: any) {
      console.error('[Auth Error] loginWithGoogle failed:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Google sign-in popup was closed.');
      }
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Console. Add this domain to Authentication -> Settings -> Authorized domains.');
      }
      throw err;
    }
  };

  // Logout
  const logout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (err: any) {
      console.error('[Auth Error] logout failed:', err);
      throw err;
    }
  };

  // Admin directly creates a new user without logging out the admin
  const adminCreateUser = async (username: string, pass: string, role: UserRole) => {
    if (!isAdmin) throw new Error('Unauthorized: Only Super Admin can directly create users.');
    const cleaned = cleanUsername(username);
    if (!cleaned || cleaned.length < 3) throw new Error('Username must be at least 3 characters.');
    if (!pass || pass.length < 6) throw new Error('Password must be at least 6 characters.');

    const virtualEmail = makeVirtualEmail(cleaned);
    const { secondaryAuth, cleanup } = createSecondaryAuth();

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, virtualEmail, pass);
      await updateProfile(cred.user, { displayName: cleaned });

      // Create approved user record
      if (db) {
        const userRef = ref(db, `users/${cred.user.uid}`);
        await set(userRef, {
          uid: cred.user.uid,
          username: cleaned,
          displayName: cleaned,
          email: virtualEmail,
          role,
          status: 'approved',
          createdAt: Date.now(),
          approvedAt: Date.now(),
          approvedBy: currentUser?.uid || 'admin',
        });
      }
    } catch (err: any) {
      console.error('[Auth Error] adminCreateUser failed:', err);
      if (err.code === 'auth/email-already-in-use') {
        throw new Error('This username is already in use.');
      }
      throw err;
    } finally {
      await cleanup();
    }
  };

  const updateApiKey = (newKey: string) => {
    saveStoredApiKey(newKey);
    setApiKey(newKey);
    // Reload page to re-initialize Firebase with fresh API key
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loadingAuth,
        isAdmin,
        isApproved,
        userRole,
        canCreate,
        isApiKeyConfigured,
        canEditEntry,
        canDeleteEntry,
        loginWithUsername,
        signupWithUsername,
        loginWithGoogle,
        logout,
        adminCreateUser,
        updateApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
