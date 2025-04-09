import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView,
  Image, ActivityIndicator // Added Image, ActivityIndicator
} from 'react-native';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // Firestore imports
import { auth, db } from '../../firebaseConfig'; // Import db
import { useRouter, Link } from 'expo-router'; // Import Link for navigation
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons'; // For placeholder icon

// Interface for user profile data from Firestore
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  // email is available from auth.currentUser
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effect to fetch profile data in real-time
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setProfile(null); // Clear profile if user logs out
      return;
    }

    setLoading(true);
    setError(null);
    const userDocRef = doc(db, "users", user.uid);

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log("Profile data fetched:", docSnap.data());
        setProfile(docSnap.data() as UserProfile);
      } else {
        // This case might happen briefly after signup before profile doc is created
        // Or if the doc creation failed.
        console.log("User document not found yet for uid:", user.uid);
        setProfile(null); // Treat as profile not set up
        // Optionally, try creating a basic doc if needed, but setup flow handles it
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching profile:", err);
      setError("Failed to load profile.");
      setLoading(false);
    });

    // Cleanup function to unsubscribe when component unmounts or user changes
    return () => unsubscribe();
  }, [user]); // Rerun effect if the user object changes

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation handled by RootLayout
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  // Determine if profile setup is needed (simple check for username)
  const needsSetup = user && !loading && (!profile || !profile.username);

  // --- Render Logic ---

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="large" color={themeColors.pink} />;
    }

    if (error) {
       return <Text style={styles.errorText}>{error}</Text>;
    }

    if (!user) {
      return <Text style={styles.infoText}>Not logged in.</Text>;
    }

    if (needsSetup) {
      // Prompt to Setup Profile
      return (
        <View style={styles.setupContainer}>
          <Text style={styles.setupText}>Welcome!</Text>
          <Text style={styles.setupSubText}>Let's set up your profile.</Text>
          <Link href="/profile-edit?mode=setup" asChild>
             <TouchableOpacity style={styles.setupButton}>
                <Text style={styles.setupButtonText}>Setup Profile</Text>
             </TouchableOpacity>
          </Link>
           <TouchableOpacity style={styles.logoutButtonSmall} onPress={handleLogout}>
               <Text style={styles.logoutButtonText}>Logout</Text>
           </TouchableOpacity>
        </View>
      );
    }

    // Display Existing Profile
    return (
      <>
        {/* Profile Picture */}
         <View style={styles.profilePicContainer}>
           {profile?.photoURL ? (
             <Image source={{ uri: profile.photoURL }} style={styles.profilePic} />
           ) : (
             <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
               <Ionicons name="person" size={60} color={themeColors.textSecondary} />
             </View>
           )}
         </View>

        {/* Display Name */}
        <Text style={styles.displayName}>
          {profile?.displayName || 'Your Name'} {/* Fallback text */}
        </Text>

        {/* Username */}
        <Text style={styles.username}>
          @{profile?.username || 'username'} {/* Fallback text */}
        </Text>

        {/* Email */}
        <View style={styles.userInfo}>
          <Text style={styles.emailText}>Email:</Text>
          <Text style={styles.emailValue} selectable={true}>{user.email}</Text>
        </View>

        {/* Edit Button */}
         <Link href={{
             pathname: "/profile-edit",
             params: {
                 mode: 'edit',
                 currentUsername: profile?.username || '', // Pass current data
                 currentDisplayName: profile?.displayName || '',
                 currentPhotoURL: profile?.photoURL || ''
             }
           }} asChild>
           <TouchableOpacity style={styles.editButton}>
               <Ionicons name="pencil" size={18} color={themeColors.textLight} />
               <Text style={styles.editButtonText}>Edit Profile</Text>
           </TouchableOpacity>
        </Link>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </>
    );
  };


  return (
    <LinearGradient
      colors={themeColors.backgroundGradient}
      style={styles.gradientWrapper}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Profile</Text>
          {renderContent()}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  gradientWrapper: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start', // Align content to top
    paddingTop: 40, // Add padding at the top
    paddingHorizontal: 20,
  },
  title: {
     fontSize: 28,
     fontWeight: 'bold',
     marginBottom: 30, // Space below title
     color: themeColors.textLight,
     textAlign: 'center', // Center title
   },
   profilePicContainer: {
       width: 120,
       height: 120,
       borderRadius: 60, // Make it circular
       overflow: 'hidden', // Clip image to border radius
       marginBottom: 20,
       borderWidth: 3,
       borderColor: themeColors.pink,
       backgroundColor: themeColors.darkGrey, // Placeholder bg
   },
   profilePic: {
       width: '100%',
       height: '100%',
   },
   profilePicPlaceholder: {
       justifyContent: 'center',
       alignItems: 'center',
   },
   displayName: {
       fontSize: 22,
       fontWeight: '600',
       color: themeColors.textLight,
       marginBottom: 5,
   },
   username: {
       fontSize: 16,
       color: themeColors.textSecondary,
       marginBottom: 25,
   },
  userInfo: {
      alignItems: 'center',
      marginBottom: 30,
      backgroundColor: themeColors.darkGrey, // Subtle background for email
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      width: '90%', // Make it wider
   },
  emailText: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginBottom: 3,
   },
  emailValue: {
      fontSize: 15,
      fontWeight: '500',
      color: themeColors.textLight,
  },
  editButton: {
      flexDirection: 'row', // Icon and text side-by-side
      alignItems: 'center',
      marginTop: 15,
      paddingHorizontal: 25,
      paddingVertical: 12,
      backgroundColor: themeColors.blue, // Different color for edit
      borderRadius: 25,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
      marginBottom: 15, // Space before logout
  },
  editButtonText: {
       color: themeColors.textLight,
       fontSize: 16,
       fontWeight: 'bold',
       marginLeft: 8, // Space between icon and text
   },
  logoutButton: {
      marginTop: 10, // Reduced margin top
      paddingHorizontal: 40,
      paddingVertical: 15,
      backgroundColor: themeColors.pink,
      borderRadius: 25,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
  },
  logoutButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  infoText: { // Style for 'Not logged in'
     fontSize: 18,
     color: themeColors.textSecondary,
     marginTop: 50,
   },
  errorText: {
     fontSize: 16,
     color: themeColors.errorRed,
     marginTop: 50,
     textAlign: 'center',
     paddingHorizontal: 15,
   },
   // Setup Prompt Styles
   setupContainer: {
       flex: 1, // Take remaining space
       justifyContent: 'center', // Center vertically
       alignItems: 'center',
       paddingBottom: 50, // Push content up slightly
   },
   setupText: {
       fontSize: 24,
       fontWeight: '600',
       color: themeColors.textLight,
       marginBottom: 10,
   },
   setupSubText: {
       fontSize: 16,
       color: themeColors.textSecondary,
       marginBottom: 30,
       textAlign: 'center',
   },
   setupButton: {
        marginTop: 10,
        paddingHorizontal: 40,
        paddingVertical: 15,
        backgroundColor: themeColors.pink,
        borderRadius: 25,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
        marginBottom: 40, // Space before logout
   },
   setupButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
   logoutButtonSmall: { // Slightly smaller logout for setup screen
        marginTop: 0,
        paddingHorizontal: 25,
        paddingVertical: 10,
        backgroundColor: 'transparent', // Less prominent
        borderColor: themeColors.grey,
        borderWidth: 1,
        borderRadius: 20,
   }
});