// app/_layout.tsx (Explicitly defining stack screens)

import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar } from 'react-native';
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
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading) {
      console.log(`(RootLayout Nav) WAITING: authLoading=${authLoading}, segments.length=${segments.length}`);
      return;
    }

    const currentPath = segments.join('/');
    console.log(`(RootLayout Nav) PROCESSING: User Authed: ${!!user}, Current Path: "${currentPath}"`);

    if (currentPath.startsWith('+html')) { console.log("(RootLayout Nav) Ignoring +html path."); return; }
    if (currentPath.startsWith('+not-found')) { console.log("(RootLayout Nav) Current path is +not-found. No redirect."); return; }
    if (currentPath === '(root)' || currentPath === '') { console.log("(RootLayout Nav) Current path is initial. No redirect."); return; }

    const publicRoutes = ['login', 'signup'];
    const authenticatedRootPathsOrGroups = ['(tabs)', 'post', 'profile-edit', 'chatRoom', 'userProfile'];

    const isCurrentRoutePublic = publicRoutes.some(route => currentPath.startsWith(route));
    const isCurrentRouteAuthenticatedArea = authenticatedRootPathsOrGroups.some(group => currentPath.startsWith(group));

    console.log(`(RootLayout Nav) Path Checks: CurrentPath="${currentPath}", isPublic=${isCurrentRoutePublic}, isAuthArea=${isCurrentRouteAuthenticatedArea}`);

    const currentUserState = auth.currentUser;

    if (currentUserState) {
      if (isCurrentRoutePublic) {
        console.log(`(RootLayout Nav) User LOGGED IN, but on AUTH screen "${currentPath}". Redirecting to /(tabs)/camera.`);
        router.replace('/(tabs)/camera');
      } else if (!isCurrentRouteAuthenticatedArea) {
        console.warn(`(RootLayout Nav) User LOGGED IN, on UNKNOWN route "${currentPath}". Redirecting to /(tabs)/camera.`);
        router.replace('/(tabs)/camera');
      } else {
        console.log(`(RootLayout Nav) User LOGGED IN, on VALID route "${currentPath}". No redirect.`);
      }
    } else {
      if (!isCurrentRoutePublic) {
        console.warn(`(RootLayout Nav) User NOT LOGGED IN and currentPath "${currentPath}" is NOT auth screen. Redirecting to /login.`);
        router.replace('/login');
      } else {
        console.log(`(RootLayout Nav) User NOT LOGGED IN, on AUTH screen. No redirect.`);
      }
    }
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
                contentStyle: { backgroundColor: 'transparent' },
             }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="profile-edit" />
            <Stack.Screen name="chatRoom" />
            <Stack.Screen name="userProfile" />
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