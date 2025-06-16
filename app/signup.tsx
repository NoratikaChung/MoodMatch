// File: app/signup.tsx (With its own LinearGradient background)

import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, Alert,
  ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform,
  StatusBar // Import StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { themeColors } from '../styles/theme';
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createFirestoreProfile = async (user: FirebaseUser) => { // Use FirebaseUser type
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    try {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        username: user.email?.split('@')[0] || `user_${user.uid.substring(0, 6)}`, // Basic username
        displayName: user.email?.split('@')[0] || "New User", // Basic display name
        photoURL: null, // Default photoURL
        createdAt: serverTimestamp(),
      });
      console.log("Firestore user profile created for:", user.uid);
    } catch (error) {
      console.error("Error creating Firestore profile:", error);
      // Optionally alert user or handle more gracefully
    }
  };

  const handleSignUp = async () => {
      if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert('Input Required', 'Please fill in all fields.'); return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match.'); return;
      }
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Password should be at least 6 characters.'); return;
      }
      setLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createFirestoreProfile(userCredential.user);
        // Navigation handled by RootLayout
      } catch (error: any) {
        console.error('Sign up error:', error);
        let errorMessage = error.message || 'An unknown error occurred.';
        if (error.code === 'auth/email-already-in-use') { errorMessage = 'Email already registered. Try logging in.'; }
        else if (error.code === 'auth/invalid-email') { errorMessage = 'Please enter a valid email address.'; }
        else if (error.code === 'auth/weak-password') { errorMessage = 'Password is too weak (min. 6 characters).'; }
        Alert.alert('Sign Up Failed', errorMessage);
      } finally { setLoading(false); }
  };

  const goToLogin = () => router.replace('/login');

  return (
    <LinearGradient
        colors={themeColors.backgroundGradient} // Apply gradient here
        style={styles.gradientWrapper}
    >
      <StatusBar barStyle="light-content" /> {/* Ensure status bar matches dark theme */}
      <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
      >
          <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>

            <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholderTextColor={themeColors.textSecondary} keyboardAppearance="dark" />
            <TextInput style={styles.input} placeholder="Password (min. 6 characters)" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={themeColors.textSecondary} keyboardAppearance="dark" />
            <TextInput style={styles.input} placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor={themeColors.textSecondary} keyboardAppearance="dark" />

             <TouchableOpacity
               style={[styles.button, styles.signupButton, loading ? styles.buttonDisabled : {}]}
               onPress={handleSignUp}
               disabled={loading} >
                  {loading ? (
                      <ActivityIndicator size="small" color={themeColors.textLight} />
                  ) : (
                      <Text style={styles.buttonText}>Sign Up</Text>
                  )}
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Already have an account? </Text>
               <TouchableOpacity onPress={goToLogin} disabled={loading}>
                  <Text style={styles.switchLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
   gradientWrapper: { // Style for the LinearGradient
     flex: 1,
   },
   keyboardAvoidingView: {
     flex: 1,
     // No background color needed here
   },
   container: {
     flex: 1,
     justifyContent: 'center',
     alignItems: 'center',
     padding: 30,
     backgroundColor: 'transparent', // Ensure this container is transparent
   },
   title: {
     fontSize: 28,
     fontWeight: 'bold',
     marginBottom: 40,
     color: themeColors.textLight,
   },
   input: {
     width: '100%',
     height: 50,
     backgroundColor: themeColors.darkGrey,
     borderColor: themeColors.grey,
     borderWidth: 1,
     marginBottom: 20,
     paddingHorizontal: 15,
     borderRadius: 10,
     fontSize: 16,
     color: themeColors.textLight,
   },
   button: {
     width: '100%',
     paddingVertical: 15,
     borderRadius: 25,
     alignItems: 'center',
     marginTop: 10,
     minHeight: 50,
     justifyContent: 'center',
   },
   signupButton: {
     backgroundColor: themeColors.pink,
     marginTop: 20,
   },
   buttonDisabled: {
     opacity: 0.6,
   },
   buttonText: {
     color: themeColors.textLight,
     fontSize: 16,
     fontWeight: 'bold',
   },
   switchContainer: {
     flexDirection: 'row',
     alignItems: 'center',
     marginTop: 30,
   },
   switchText: {
     fontSize: 14,
     color: themeColors.textSecondary,
   },
   switchLink: {
     fontSize: 14,
     color: themeColors.pink,
     fontWeight: 'bold',
     marginLeft: 5,
   },
});
