// app/_layout.tsx (With contentStyle for transparent screen backgrounds)

import React, { useState, useEffect, ComponentType } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, ViewProps } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';

export default function RootLayoutNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading || segments.length === 0) return;

    const path = segments.join('/');
    const isUserOnAuthScreen = path.startsWith('login') || path.startsWith('signup');
    const isUserOnTabsScreen = path.startsWith('(tabs)');

    const isUserOnAllowedStandaloneScreen =
         path.startsWith('profile-edit') ||
         path.startsWith('chatRoom');

    const timerId = setTimeout(() => {
      const currentUserState = auth.currentUser;

      if (currentUserState && (isUserOnTabsScreen || isUserOnAllowedStandaloneScreen)) {
        return;
      }
      if (!currentUserState && !isUserOnAuthScreen) {
        router.replace('/login');
      } else if (currentUserState && !isUserOnTabsScreen && !isUserOnAllowedStandaloneScreen) {
        router.replace('/(tabs)/camera');
      }
    }, 50);
    return () => clearTimeout(timerId);
  }, [user, authLoading, segments, router]);

  return (
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
              cardStyle: { backgroundColor: 'transparent' },
              contentStyle: { backgroundColor: 'transparent' }, // Ensure content area is transparent
           }}
        >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="profile-edit" />
            <Stack.Screen name="chatRoom" />
            {/* No need to list userProfile here if it's handled by (tabs)/_layout.tsx */}
        </Stack>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { flex: 1, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
});