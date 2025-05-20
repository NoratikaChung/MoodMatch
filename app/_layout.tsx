// app/_layout.tsx (Corrected for userProfile being part of Tabs)

import React, { useState, useEffect, ComponentType } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, ViewProps } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';
import { MenuProvider } from 'react-native-popup-menu';

export default function RootLayoutNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      // console.log('(RootLayout Auth) State Changed -> User:', currentUser ? currentUser.uid : 'null');
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => {
      // console.log("(RootLayout Auth) Unsubscribing");
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading || segments.length === 0) {
      // console.log(`(RootLayout Nav) Waiting: authLoading=${authLoading}, segments=${segments.length}`);
      return;
    }

    const currentPath = segments.join('/');
    // console.log(`(RootLayout Nav) Ready. User: ${!!user}, Path: ${currentPath}`);

    // Screens a logged-out user is allowed to be on
    const isUserOnAuthScreen = currentPath.startsWith('login') || currentPath.startsWith('signup');

    // Screens a logged-in user is allowed to be on (includes all tab screens and specific standalone screens)
    const isUserOnTabsScreen = currentPath.startsWith('(tabs)'); // This will cover (tabs)/userProfile
    const isUserOnAllowedStandaloneScreen = currentPath.startsWith('profile-edit'); // Add other standalone screens here if any

    const timerId = setTimeout(() => {
      const currentUserState = auth.currentUser;
      // console.log(`(RootLayout Nav - Delayed) Checking: User=${!!currentUserState}, Path: ${currentPath}, OnAuth=${isUserOnAuthScreen}, OnTabs=${isUserOnTabsScreen}, OnAllowedStandalone=${isUserOnAllowedStandaloneScreen}`);

      if (currentUserState) {
        // User is logged in
        if (isUserOnTabsScreen || isUserOnAllowedStandaloneScreen) {
          // Already on a valid screen for logged-in users (tabs or allowed standalone)
          // console.log("(RootLayout Nav - Delayed) User logged in, on valid screen. No redirect.");
          return;
        } else {
          // Logged in, but not on a tab screen or allowed standalone (e.g., was on login/signup)
          // console.log("(RootLayout Nav - Delayed) User logged in, NOT on tabs/allowed. Redirecting to /(tabs)/camera");
          router.replace('/(tabs)/camera');
        }
      } else {
        // User is NOT logged in
        if (!isUserOnAuthScreen) {
          // Not logged in and not on an auth screen
          // console.log("(RootLayout Nav - Delayed) User logged out, NOT on auth. Redirecting to /login");
          router.replace('/login');
        } else {
          // Not logged in, but already on an auth screen. No redirect needed.
          // console.log("(RootLayout Nav - Delayed) User logged out, on auth screen. No redirect.");
        }
      }
    }, 50); // Small delay for route stability

    return () => clearTimeout(timerId);
  }, [user, authLoading, segments, router]);


  return (
    <MenuProvider>
      <LinearGradient
        colors={themeColors.backgroundGradient}
        style={styles.gradientContainer}
      >
        <StatusBar barStyle="light-content" />
        {authLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.pink} />
          </View>
        ) : (
          <Stack
             screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: 'transparent' }, // For background gradient
                contentStyle: { backgroundColor: 'transparent' },// For background gradient
             }}
          >
              {/* (tabs) group will handle all screens inside app/(tabs), including userProfile */}
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="login" />
              <Stack.Screen name="signup" />
              <Stack.Screen name="profile-edit" />
              {/*
                Ensure 'chatRoom' is either defined in app/(tabs)/_layout.tsx (if tabs should be visible)
                OR if it's a standalone screen like login/signup, its file should be app/chatRoom.tsx
                and then it can be listed here or discovered by Expo Router automatically.
                For now, assuming it might be a standalone screen like profile-edit.
              */}
              <Stack.Screen name="chatRoom" />

              {/*
                DO NOT list 'userProfile' here if it's defined and handled
                within app/(tabs)/_layout.tsx (which it is, for Option A).
                The '(tabs)' screen group definition above covers it.
              */}
          </Stack>
        )}
      </LinearGradient>
    </MenuProvider>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
});