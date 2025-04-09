import React, { useState, useEffect, ComponentType } from 'react'; // Removed useRef
import { ActivityIndicator, View, StyleSheet, StatusBar, ViewProps } from 'react-native';
import { Slot as ExpoSlot, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';

// Type Assertion for Slot (If needed for your TS setup)
const Slot = ExpoSlot as ComponentType<ViewProps>;

export default function RootLayoutNav() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Removed: const navigationAttemptedRef = useRef(false);
  const router = useRouter();
  const segments = useSegments(); // Hook to get current URL segments

  // Effect to handle authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('(Effect Auth) State Changed -> User:', currentUser ? currentUser.uid : 'null');
      setUser(currentUser);
      setAuthLoading(false); // Auth state is now known

      // No longer need to manage the navigationAttemptedRef here
    });
    return () => {
        console.log("(Effect Auth) Unsubscribing");
        unsubscribe();
    };
  }, []); // Run only once on mount

  // Effect to handle navigation AFTER auth state is known AND initial route determined
  useEffect(() => {
    // Wait until auth loading is false AND router has determined segments
    if (authLoading || segments.length <= 0) {
        console.log(`(Effect Nav) Waiting: authLoading=${authLoading}, segments=${segments.length}`);
        return;
    }

    // <<< --- Ref logic removed --- >>>
    // The core logic is now just inside the setTimeout

    console.log(`(Effect Nav) Ready to check route. User: ${!!user}, Segments: ${segments.join('/')}`);

    const isUserOnAuthScreen = segments.includes('login') || segments.includes('signup');
    const isUserOnTabsScreen = segments.includes('(tabs)');

    // Use setTimeout to slightly delay navigation, allowing state to settle
    const timerId = setTimeout(() => {
        // Re-check user state inside timeout for maximum freshness
        const currentUserState = auth.currentUser;

        console.log(`(Effect Nav - Delayed) Checking: User=${!!currentUserState}, OnAuth=${isUserOnAuthScreen}, OnTabs=${isUserOnTabsScreen}, Segments=${segments.join('/')}`);

        // Condition 1: User is NOT logged in, AND they are NOT on an auth screen -> redirect to login
        if (!currentUserState && !isUserOnAuthScreen) {
            console.log("(Effect Nav - Delayed) User null, NOT on auth screen. Replacing with /login");
            router.replace('/login');
        // Condition 2: User IS logged in, AND they are NOT in the main '(tabs)' group -> redirect to tabs
        } else if (currentUserState && !isUserOnTabsScreen) {
            console.log("(Effect Nav - Delayed) User exists, NOT on tabs screen. Replacing with /(tabs)/image");
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


  // --- Render Logic ---
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

// --- Styles ---
const styles = StyleSheet.create({
  gradientContainer: { flex: 1, },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', },
});