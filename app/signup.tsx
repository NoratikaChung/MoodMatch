// File: app/signup.tsx

import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { themeColors } from '../styles/theme'; // Import theme

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const createFirestoreProfile = async (user: User) => { /* ... keep logic ... */ };
  const handleSignUp = async () => { /* ... keep logic ... */
      // Basic Validation
      if (!email.trim() || !password.trim() || !confirmPassword.trim()) { Alert.alert('Input Required', 'Please fill in all fields.'); return; }
      if (password !== confirmPassword) { Alert.alert('Password Mismatch', 'Passwords do not match.'); return; }
      if (password.length < 6) { Alert.alert('Weak Password', 'Password should be at least 6 characters.'); return; }
      setLoading(true);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await createFirestoreProfile(userCredential.user); // Create profile right after auth user created
        // Nav handled by RootLayout
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
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}>
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
  );
}

// Use similar styles to Login, adjust slightly if needed
const styles = StyleSheet.create({
   keyboardAvoidingView: { flex: 1 /* Background from RootLayout */ },
   container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, /*backgroundColor: 'transparent'*/ },
   title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40, color: themeColors.textLight, },
   input: { width: '100%', height: 50, backgroundColor: themeColors.darkGrey, borderColor: themeColors.grey, borderWidth: 1, marginBottom: 20, paddingHorizontal: 15, borderRadius: 10, fontSize: 16, color: themeColors.textLight, },
   button: { width: '100%', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center' },
   signupButton: { backgroundColor: themeColors.pink, marginTop: 20, }, // Pink Sign Up
   buttonDisabled: { opacity: 0.6, },
   buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
   switchContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 30, },
   switchText: { fontSize: 14, color: themeColors.textSecondary, },
   switchLink: { fontSize: 14, color: themeColors.pink, fontWeight: 'bold', marginLeft: 5, },
});