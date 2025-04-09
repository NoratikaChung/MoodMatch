import React, { useState, useEffect, ComponentType } from 'react';
import { ActivityIndicator, View, StyleSheet, StatusBar, ViewProps } from 'react-native';
import { Slot as ExpoSlot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';

const Slot = ExpoSlot as ComponentType<ViewProps>;

export default function RootLayoutNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Effect to handle authentication state changes (Unchanged)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('(Effect Auth) State Changed -> User:', currentUser ? currentUser.uid : 'null');
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => {
      console.log("(Effect Auth) Unsubscribing");
      unsubscribe();
    };
  }, []);

  // Effect to handle navigation
  useEffect(() => {
    // Wait until auth loading is false AND router has determined segments
    if (authLoading || segments.length <= 0) { // Using <= 0 from previous fix
      console.log(`(Effect Nav) Waiting: authLoading=${authLoading}, segments=${segments.length}`);
      return;
    }

    console.log(`(Effect Nav) Ready to check route. User: ${!!user}, Segments: ${segments.join('/')}`);

    // Determine current screen group *before* the timeout
    const isUserOnAuthScreen = segments.includes('login') || segments.includes('signup');
    const isUserOnTabsScreen = segments.includes('(tabs)');
    // <<< --- ADDED CHECK for allowed non-tab screen --- >>>
    const isUserOnAllowedScreen = segments.includes('profile-edit');
    // <<< --- END ADDED CHECK --- >>>

    // Use setTimeout to slightly delay navigation, allowing state to settle
    const timerId = setTimeout(() => {
      // Re-check user state inside timeout for maximum freshness
      const currentUserState = auth.currentUser;

      console.log(`(Effect Nav - Delayed) Checking: User=${!!currentUserState}, OnAuth=${isUserOnAuthScreen}, OnTabs=${isUserOnTabsScreen}, OnAllowed=${isUserOnAllowedScreen}, Segments=${segments.join('/')}`);

      // <<< --- ADDED GUARD --- >>>
      // If user is logged in AND on an allowed screen (like profile-edit), skip redirection
      if (currentUserState && isUserOnAllowedScreen) {
          console.log("(Effect Nav - Delayed) User is on an allowed screen (profile-edit), skipping redirect.");
          // IMPORTANT: We still need to clear the timer even if we return early
          // Although clearTimeout is in the cleanup, explicit clear here might be safer in edge cases.
          // clearTimeout(timerId); // Optional: Explicit clear here
          return; // Do nothing, stay on profile-edit
      }
      // <<< --- END ADDED GUARD --- >>>


      // Condition 1: User is NOT logged in, AND they are NOT on an auth screen -> redirect to login
      if (!currentUserState && !isUserOnAuthScreen) {
        console.log("(Effect Nav - Delayed) User null, NOT on auth screen. Replacing with /login");
        router.replace('/login');
      // Condition 2: User IS logged in, AND NOT in tabs group (AND NOT on allowed screen) -> redirect to tabs
      } else if (currentUserState && !isUserOnTabsScreen) { // The isUserOnAllowedScreen check above prevents this now for profile-edit
        console.log("(Effect Nav - Delayed) User exists, NOT on tabs/allowed screen. Replacing with /(tabs)/image");
        router.replace('/(tabs)/image');
      // Condition 3: User state matches current screen group (logged in on tabs, logged out on auth) -> do nothing
      } else {
        console.log("(Effect Nav - Delayed) User state matches current screen group, no redirect needed.");
      }
    }, 50); // 50ms delay

    // Cleanup the timer if the effect re-runs before the timeout completes
    return () => clearTimeout(timerId);

  // Re-run when user OR authLoading OR segments change
  }, [user, authLoading, segments, router]);


  // --- Render Logic (Unchanged) ---
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
        // Render the current route determined by Expo Router
        <Slot />
      )}
    </LinearGradient>
  );
}

// --- Styles (Unchanged) ---
const styles = StyleSheet.create({
  gradientContainer: { flex: 1, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
});