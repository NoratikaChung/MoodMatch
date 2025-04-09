import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView, Platform } from 'react-native'; // Added Platform
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useRouter } from 'expo-router';

// --- Gradient ---
import { LinearGradient } from 'expo-linear-gradient'; // <<< ADDED Import
import { themeColors } from '../../styles/theme'; // Import theme

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation is handled by RootLayout effect now
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  return (
      // <<< WRAP with LinearGradient >>>
      <LinearGradient
        colors={themeColors.backgroundGradient}
        style={styles.gradientWrapper}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
              {/* --- Original Content START --- */}
              <Text style={styles.title}>Profile</Text>
              {user ? (
                <View style={styles.userInfo}>
                  <Text style={styles.emailText}>Logged in as:</Text>
                  <Text style={styles.emailValue} selectable={true}>{user.email}</Text>
                </View>
              ) : (
                <Text style={styles.emailText}>Not logged in.</Text>
              )}
               <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Text style={styles.logoutButtonText}>Logout</Text>
               </TouchableOpacity>
              {/* --- Original Content END --- */}
          </View>
        </SafeAreaView>
      </LinearGradient>
      // <<< END WRAP >>>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  // <<< ADDED gradient wrapper style >>>
  gradientWrapper: {
      flex: 1,
  },
  safeArea: {
    flex: 1,
    // backgroundColor: 'transparent', // <<< REMOVED this line
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    // backgroundColor: 'transparent', // <<< REMOVED this line
  },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40, color: themeColors.textLight, },
  userInfo: { marginBottom: 40, alignItems: 'center', },
  emailText: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 5, },
  emailValue: { fontSize: 18, fontWeight: '500', color: themeColors.textLight, marginTop: 5, },
  logoutButton: {
      marginTop: 30, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25,
      // Shadow for iOS
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
      // Elevation for Android
      elevation: 5,
      // Box shadow for Web <<< ADDED
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },
  logoutButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', }
});