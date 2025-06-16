// File: app/login.tsx (With its own LinearGradient background)

import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet, Alert,
  ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, Platform,
  StatusBar // Import StatusBar
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { themeColors } from '../styles/theme';
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Input Required', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation handled by RootLayout observer
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', error.message || 'Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const goToSignUp = () => router.push('/signup');

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

            <TouchableOpacity
               style={[styles.button, styles.loginButton, loading ? styles.buttonDisabled : {}]}
               onPress={handleLogin}
               disabled={loading}
            >
               {loading ? (
                   <ActivityIndicator size="small" color={themeColors.textLight} />
               ) : (
                   <Text style={styles.buttonText}>Login</Text>
               )}
            </TouchableOpacity>

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>Don't have an account? </Text>
              <TouchableOpacity onPress={goToSignUp} disabled={loading}>
                  <Text style={styles.switchLink}>Sign Up</Text>
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
    // No background color needed here as gradient is the parent
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: 'transparent', // Ensure this container is transparent over the gradient
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
  loginButton: {
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