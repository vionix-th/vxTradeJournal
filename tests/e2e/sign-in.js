import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../src/persistence/firebase.js';
export const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);
