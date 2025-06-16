// File: app/userProfile.tsx (Full code with detailed logging for chat creation)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView,
  Image, ActivityIndicator, Platform, StatusBar
} from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Path relative to app/userProfile.tsx
import { useLocalSearchParams, useRouter, useNavigation, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme'; // Path relative to app/userProfile.tsx
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
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ userId?: string }>();
  const profileUserId = params.userId; // The ID of the profile being viewed

  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  // Effect to update currentUser state if auth state changes
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Effect to fetch profile data based *only* on the userId parameter and set title
  useEffect(() => {
    if (!profileUserId) {
      setError("User ID not provided.");
      setIsLoading(false);
      navigation.setOptions({ title: 'Error' });
      return;
    }

    setIsLoading(true);
    setError(null);
    const userDocRef = doc(db, "users", profileUserId);

    getDoc(userDocRef).then(docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfileData(data);
        navigation.setOptions({ title: data.username || data.displayName || 'User Profile' });
      } else {
        console.log("UserProfileScreen: User document not found for uid:", profileUserId);
        setProfileData(null);
        setError("User profile not found.");
        navigation.setOptions({ title: 'Not Found' });
      }
    }).catch(err => {
      console.error("UserProfileScreen: Error fetching profile:", err);
      setError("Failed to load profile.");
      navigation.setOptions({ title: 'Error' });
      setProfileData(null);
    }).finally(() => {
      setIsLoading(false);
    });

  }, [profileUserId, navigation]);

  // --- Start Chat Handler with DETAILED LOGGING ---
  const handleStartChat = async () => {
    if (!currentUser) {
      Alert.alert("Login Required", "Please log in to start a chat.");
      return;
    }
    if (!profileUserId) {
        Alert.alert("Error", "Cannot start chat: Target user ID is missing.");
        return;
    }
    if (currentUser.uid === profileUserId) {
        Alert.alert("Error", "You cannot start a chat with yourself.");
        return;
    }
    if (chatLoading) return; // Prevent double clicks

    console.log(`LIVE: Attempting to start chat between CURRENT USER: ${currentUser.uid} and OTHER USER: ${profileUserId}`);
    setChatLoading(true);

    try {
      const currentUserId = currentUser.uid;
      const otherUserId = profileUserId;

      // Create a consistent, sorted chat ID
      const sortedUserIds = [currentUserId, otherUserId].sort();
      const chatId = sortedUserIds.join('_');
      const chatDocRef = doc(db, 'chats', chatId);

      // Fetch user details for denormalization
      const currentUserDocSnap = await getDoc(doc(db, 'users', currentUserId));
      // profileData for the other user is already fetched by the screen's useEffect

      const currentUserProfile = currentUserDocSnap.data();

      const chatDataToSave = {
          users: sortedUserIds, // Use the sorted array with currentUserId and otherUserId
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null,
          userNames: {
              [currentUserId]: currentUserProfile?.username || currentUserProfile?.displayName || `User ${currentUserId.substring(0,5)}`,
              [otherUserId]: profileData?.username || profileData?.displayName || `User ${otherUserId.substring(0,5)}`,
          },
          userPhotos: {
              [currentUserId]: currentUserProfile?.photoURL || null,
              [otherUserId]: profileData?.photoURL || null,
          },
          readBy: {
            [currentUserId]: serverTimestamp(), // The user creating the chat has "read" up to this point
            [otherUserId]: Timestamp.fromDate(new Date(0)) // The other user has read nothing (epoch time)
        }
      };

      // --- CRITICAL LOGS FOR DEBUGGING THE RULE ---
      console.log("--- LIVE Firebase: Data for setDoc('chats/{chatId}') ---");
      console.log("Chat ID (Document Path for setDoc):", chatId);
      // Log the data that will become request.resource.data in rules
      console.log("Data (request.resource.data will be this):", JSON.stringify(chatDataToSave, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === ' Timestamp') {
          return '(Firestore ServerTimestamp representation for log)';
        }
        if (value && typeof value === 'object' && value._methodName === 'serverTimestamp') {
            return '(Firestore ServerTimestamp representation for log)';
        }
        return value;
      }, 2));
      console.log("Authenticated User UID (request.auth.uid will be this):", currentUserId);
      console.log("Is auth UID in chatDataToSave.users array?", chatDataToSave.users.includes(currentUserId));
      console.log("Size of chatDataToSave.users array:", chatDataToSave.users.length);
      console.log("Is users[0] a string?", typeof chatDataToSave.users[0] === 'string');
      console.log("Is users[1] a string?", typeof chatDataToSave.users[1] === 'string');
      // --- END CRITICAL LOGS ---

      // Check if chat already exists before trying to create with setDoc
      const chatDocSnap = await getDoc(chatDocRef);
      if (!chatDocSnap.exists()) {
          console.log("Chat does not exist, creating with setDoc:", chatId);
          await setDoc(chatDocRef, chatDataToSave); // Use setDoc to create with specific ID
          console.log("New chat document CREATED successfully with ID:", chatId);
      } else {
          console.log("Chat already exists with ID:", chatId, ". Navigating to existing chat.");
          // Optionally update 'updatedAt' if you want to signify activity
          // await updateDoc(chatDocRef, { updatedAt: serverTimestamp() });
      }

      router.push({ pathname: '/chatRoom', params: { chatId: chatId } }); // Path to app/chatRoom.tsx

    } catch (error: any) {
      console.error("LIVE Firebase: Error in handleStartChat: ", error);
      Alert.alert("Error Starting Chat", error.message || "Could not initiate chat. Check console for details.");
    } finally {
      setChatLoading(false);
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (isLoading) {
      return <ActivityIndicator size="large" color={themeColors.pink} style={{ marginTop: 50 }} />;
    }
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (!profileData) {
      return <Text style={styles.infoText}>User profile not available.</Text>;
    }

    const displayData = profileData;
    return (
      <>
        <View style={styles.profilePicContainer}>
          {displayData.photoURL ? <Image source={{ uri: displayData.photoURL }} style={styles.profilePic} /> : <View style={[styles.profilePic, styles.profilePicPlaceholder]}><Ionicons name="person" size={60} color={themeColors.textSecondary} /></View>}
        </View>
        <Text style={styles.displayName}>{displayData.displayName || 'User'}</Text>
        <Text style={styles.username}>@{displayData.username || 'username'}</Text>
        {displayData.email && ( // Only display email if it exists on profileData
          <View style={styles.userInfo}><Text style={styles.emailText}>Email:</Text><Text style={styles.emailValue} selectable={true}>{displayData.email}</Text></View>
        )}
        {profileUserId !== currentUser?.uid && (
          <TouchableOpacity
            style={[styles.chatButton, chatLoading && styles.buttonDisabled]}
            onPress={handleStartChat}
            disabled={chatLoading || !currentUser}
          >
            {chatLoading ? (<ActivityIndicator color={themeColors.textLight} size="small" />)
             : (<><Ionicons name="chatbubbles-outline" size={18} color={themeColors.textLight} style={{ marginRight: 8 }} /><Text style={styles.buttonText}>Start Chat</Text></>)}
          </TouchableOpacity>
        )}
      </>
    );
  };

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper} >
      <Stack.Screen // This configures the header for this specific screen
        options={{
          headerShown: true,
          // Title is set dynamically in useEffect once profileData is fetched
          headerStyle: { backgroundColor: themeColors.darkGrey },
          headerTintColor: themeColors.textLight, // Color of back arrow and default title
          headerTitleStyle: { color: themeColors.textLight },
        }}
      />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {renderContent()}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  container: { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 20, },
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, overflow: 'hidden', alignSelf: 'center' },
  profilePic: { width: '100%', height: '100%' },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5, textAlign: 'center' },
  username: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 25, textAlign: 'center' },
  userInfo: { alignItems: 'center', marginBottom: 30, backgroundColor: themeColors.darkGrey, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, width: '90%', alignSelf: 'center', maxWidth: 400 },
  emailText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 3 },
  emailValue: { fontSize: 15, fontWeight: '500', color: themeColors.textLight },
  chatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 30, paddingVertical: 15, backgroundColor: themeColors.blue, borderRadius: 25, minWidth: '60%', alignSelf: 'center' },
  buttonDisabled: { backgroundColor: themeColors.grey, opacity: 0.7 },
  buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  infoText: { fontSize: 18, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center' },
  errorText: { fontSize: 16, color: themeColors.errorRed, marginTop: 50, textAlign: 'center', paddingHorizontal: 15 },
});