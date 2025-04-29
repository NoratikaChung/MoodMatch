// app/(tabs)/userProfile.tsx (Modified - Moved into tabs, header handled by layout)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView,
  Image, ActivityIndicator
} from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
// --- ADJUST PATHS: Now relative to app/(tabs)/ ---
import { auth, db } from '../../firebaseConfig';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'; // Removed Stack import
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
// --- END ADJUST PATHS ---
import { Ionicons } from '@expo/vector-icons';
import { User as FirebaseAuthUser } from 'firebase/auth';

// Interface for user profile data from Firestore
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  email?: string; // Optional: if you store public email
}

export default function UserProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation(); // Still needed for setting title dynamically
  const params = useLocalSearchParams<{ userId: string }>();
  const profileUserId = params.userId;

  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Effect to update currentUser state if auth state changes (Unchanged)
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return unsubscribeAuth;
  }, []);

  // Effect to fetch profile data and set header title (Unchanged logic, removed Stack.Screen)
  useEffect(() => {
    if (!profileUserId) {
      setError("User ID not provided.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const userDocRef = doc(db, "users", profileUserId);

    getDoc(userDocRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfileData(data);
        // Set header title dynamically using navigation hook
        navigation.setOptions({ title: data.username || data.displayName || 'User Profile' });
      } else {
        setProfileData(null);
        setError("User profile not found.");
        navigation.setOptions({ title: 'Not Found' }); // Update title on error too
      }
    }).catch(err => {
      console.error("UserProfileScreen: Error fetching profile:", err);
      setError("Failed to load profile.");
      navigation.setOptions({ title: 'Error' });
      setProfileData(null);
    }).finally(() => {
      setIsLoading(false);
    });

  }, [profileUserId, navigation]); // Keep dependencies

  // --- Start Chat Handler (Unchanged) ---
  const handleStartChat = async () => {
    // ... (keep the exact same chat starting logic as before) ...
    if (!currentUser || !profileUserId || chatLoading) {
      if (!currentUser) Alert.alert("Login Required", "Please log in to start a chat.");
      console.warn("Start Chat conditions not met:", { currentUser: !!currentUser, profileUserId, chatLoading });
      return;
    }
    console.log(`Starting chat between ${currentUser.uid} and ${profileUserId}`);

    setChatLoading(true);
    try {
      const currentUserId = currentUser.uid;
      const otherUserId = profileUserId;

      const chatId = [currentUserId, otherUserId].sort().join('_');
      const chatDocRef = doc(db, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);

      let finalChatId = chatId;

      if (!chatDocSnap.exists()) {
        console.log("Creating new chat document with ID:", chatId);
        const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        const currentUserData = currentUserDoc.data();
        const otherUserData = profileData;

        await setDoc(chatDocRef, {
          users: [currentUserId, otherUserId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null,
          userNames: {
            [currentUserId]: currentUserData?.username || 'User',
            [otherUserId]: otherUserData?.username || 'User',
          },
          userPhotos: {
            [currentUserId]: currentUserData?.photoURL || null,
            [otherUserId]: otherUserData?.photoURL || null,
          }
        });
        console.log("Created new chat with ID:", finalChatId);
      } else {
        finalChatId = chatDocSnap.id;
        console.log("Chat already exists with ID:", finalChatId);
      }

      console.log("Navigating to chatRoom with chatId:", finalChatId);
       // IMPORTANT: Ensure chatRoom screen path is correct (likely outside tabs now)
       router.push({ pathname: '/chatRoom', params: { chatId: finalChatId } });

    } catch (error) {
      console.error("Error starting chat: ", error);
      Alert.alert("Error", "Could not start chat.");
    } finally {
      setChatLoading(false);
    }
  };
  // --- End Start Chat Handler ---

  // --- Render Logic (Unchanged) ---
  const renderContent = () => {
    // ... (keep the exact same render logic as before) ...
    if (isLoading) { return <ActivityIndicator size="large" color={themeColors.pink} style={{ marginTop: 50 }} />; }
    if (error) { return <Text style={styles.errorText}>{error}</Text>; }
    if (!profileData) { return <Text style={styles.infoText}>User profile not available.</Text>; }

    const displayData = profileData;
    return (
      <>
        <View style={styles.profilePicContainer}>
          {displayData.photoURL ? (<Image source={{ uri: displayData.photoURL }} style={styles.profilePic} />)
           : (<View style={[styles.profilePic, styles.profilePicPlaceholder]}><Ionicons name="person" size={60} color={themeColors.textSecondary} /></View>)}
        </View>
        <Text style={styles.displayName}>{displayData.displayName || 'User'}</Text>
        <Text style={styles.username}>@{displayData.username || 'username'}</Text>
        {displayData.email && (
          <View style={styles.userInfo}><Text style={styles.emailText}>Email:</Text><Text style={styles.emailValue} selectable={true}>{displayData.email}</Text></View>
        )}
        {profileUserId !== currentUser?.uid ? (
          <TouchableOpacity
            style={[styles.chatButton, chatLoading && styles.buttonDisabled]}
            onPress={handleStartChat}
            disabled={chatLoading || !currentUser}
          >
            {chatLoading ? (<ActivityIndicator color="#fff" size="small" />)
             : (<><Ionicons name="chatbubbles-outline" size={18} color={themeColors.textLight} style={{ marginRight: 8 }} /><Text style={styles.buttonText}>Start Chat</Text></>)}
          </TouchableOpacity>
        ) : (<Text style={styles.infoText}>Viewing your own profile via direct link?</Text>)}
      </>
    );
  };
  // --- End Render Logic ---

  return (
    <LinearGradient
      colors={themeColors.backgroundGradient}
      style={styles.gradientWrapper}
    >
      {/* --- REMOVED Stack.Screen wrapper --- */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Title is handled by header options in layout */}
          {renderContent()}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// --- Styles (Ensure paths are correct for themeColors etc. if copied) ---
const styles = StyleSheet.create({
  // ... (keep the exact same styles as before) ...
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 }, // Adjust paddingTop if header overlaps
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, overflow: 'hidden' },
  profilePic: { width: '100%', height: '100%' },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5 },
  username: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 25 },
  userInfo: { alignItems: 'center', marginBottom: 30, backgroundColor: themeColors.darkGrey, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, width: '90%' },
  emailText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 3 },
  emailValue: { fontSize: 15, fontWeight: '500', color: themeColors.textLight },
  chatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 30, paddingVertical: 15, backgroundColor: themeColors.blue, borderRadius: 25, minWidth: '60%' },
  buttonDisabled: { backgroundColor: themeColors.grey, opacity: 0.7 },
  buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  infoText: { fontSize: 18, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center' },
  errorText: { fontSize: 16, color: themeColors.errorRed, marginTop: 50, textAlign: 'center', paddingHorizontal: 15 },
});