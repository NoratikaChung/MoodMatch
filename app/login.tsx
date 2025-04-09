// File: app/login.tsx

import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { themeColors } from '../styles/theme'; // Import theme

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    // <<< --- ADDED LOG --- >>>
    console.log("Login button pressed. Current loading state:", loading);
    // If already loading, maybe don't proceed? (Optional check)
    // if (loading) return;

    if (!email.trim() || !password.trim()) {
      Alert.alert('Input Required', 'Please enter both email and password.');
      return;
    }
    // <<< --- ADDED LOG --- >>>
    console.log("Attempting Firebase Sign In...");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // <<< --- ADDED LOG --- >>>
      console.log('Firebase Login successful (auth state will trigger redirect)');
      // Navigation handled by RootLayout observer
    } catch (error: any) {
      console.error('Login error:', error); // Log the actual error object
      Alert.alert('Login Failed', error.message || 'Check credentials.');
    } finally {
      // <<< --- ADDED LOG --- >>>
      console.log("Login attempt finished, setting loading to false.");
      setLoading(false); // Ensure loading stops
    }
  };

  const goToSignUp = () => router.push('/signup');

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}>
        <View style={styles.container}>
          <Text style={styles.title}>MoodMatch Login</Text>

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholderTextColor={themeColors.textSecondary}
            keyboardAppearance="dark"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={themeColors.textSecondary}
            keyboardAppearance="dark"
          />

          {/* <<< --- ADDED LOG --- >>> */}
          {/* Log the loading state right before rendering the button */}
          {console.log("Rendering Login Button. Is loading?", loading)}
          <TouchableOpacity
             style={[styles.button, styles.loginButton, loading ? styles.buttonDisabled : {}]}
             onPress={handleLogin} // Verify onPress points here
             disabled={loading} // Verify disabled uses loading state
          >
             {loading ? (
                 <ActivityIndicator size="small" color={themeColors.textLight} />
             ) : (
                 <Text style={styles.buttonText}>Login</Text>
             )}
          </TouchableOpacity>

          {/* Switch to Sign Up */}
          <View style={styles.switchContainer}>
            <Text style={styles.switchText}>Don't have an account? </Text>
            <TouchableOpacity onPress={goToSignUp} disabled={loading}>
                <Text style={styles.switchLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>
    </KeyboardAvoidingView>
  );
}

// --- Styles --- (Keep styles as they were)
const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 /* Background from RootLayout */ },
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30,
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40, color: themeColors.textLight, },
  input: { width: '100%', height: 50, backgroundColor: themeColors.darkGrey, borderColor: themeColors.grey, borderWidth: 1, marginBottom: 20, paddingHorizontal: 15, borderRadius: 10, fontSize: 16, color: themeColors.textLight, },
  button: { width: '100%', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 10, minHeight: 50, justifyContent: 'center' },
  loginButton: { backgroundColor: themeColors.pink, marginTop: 20, },
  buttonDisabled: { opacity: 0.6, },
  buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  switchContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 30, },
  switchText: { fontSize: 14, color: themeColors.textSecondary, },
  switchLink: { fontSize: 14, color: themeColors.pink, fontWeight: 'bold', marginLeft: 5, },
});