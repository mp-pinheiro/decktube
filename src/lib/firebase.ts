import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  signInWithCredential,
  GoogleAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore/lite'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let currentUser: User | null = null

function isConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId)
}

function ensureInitialized(): boolean {
  if (app) return true
  if (!isConfigured()) return false
  try {
    app = initializeApp(firebaseConfig)
    auth = getAuth(app)
    db = getFirestore(app)
    return true
  } catch (err) {
    console.warn('Firebase initialization failed:', err)
    return false
  }
}

export async function initFirebaseAuth(idToken: string): Promise<User> {
  if (!ensureInitialized() || !auth) {
    throw new Error('Firebase not configured')
  }
  const credential = GoogleAuthProvider.credential(idToken)
  const result = await signInWithCredential(auth, credential)
  currentUser = result.user
  return result.user
}

export function getFirebaseUser(): User | null {
  return currentUser
}

export function getFirebaseDb(): Firestore | null {
  return db
}

export function isFirebaseReady(): boolean {
  return !!(currentUser && db)
}

export async function signOutFirebase(): Promise<void> {
  if (auth) {
    const { signOut } = await import('firebase/auth')
    await signOut(auth)
  }
  currentUser = null
}
