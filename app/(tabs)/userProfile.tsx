// File: app/userProfile.tsx (Standalone screen - with detailed logging for chat creation)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView,
  Image, ActivityIndicator, Platform, StatusBar // Added Platform, StatusBar
} from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; // Adjusted path for root app/
import { useLocalSearchParams, useRouter, useNavigation, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme'; // Adjusted path for root app/
import { Ionicons } from '@expo/vector-icons';
import { User as FirebaseAuthUser } from 'firebase/auth';

// Interface for user profile data from Firestore
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
  email?: string;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ userId?: string }>(); // Expecting userId, make it optional for safety
  const profileUserId = params.userId;

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

    console.log(`Attempting to start chat between CURRENT USER: ${currentUser.uid} and OTHER USER: ${profileUserId}`);
    setChatLoading(true);

    try {
      const currentUserId = currentUser.uid;
      const otherUserId = profileUserId;

      // Create a consistent, sorted chat ID
      const sortedUserIds = [currentUserId, otherUserId].sort();
      const chatId = sortedUserIds.join('_');
      const chatDocRef = doc(db, 'chats', chatId);

      // Check if chat already exists (using getDoc)
      const chatDocSnap = await getDoc(chatDocRef);

      let finalChatId = chatId; // Will be used for navigation

      if (!chatDocSnap.exists()) {
        console.log("Chat does not exist. Creating new chat document with ID:", chatId);

        // Fetch minimal user data for denormalization
        const currentUserDocSnap = await getDoc(doc(db, 'users', currentUserId));
        // profileData is for the *other* user, already fetched.
        // const otherUserDocSnap = await getDoc(doc(db, 'users', otherUserId)); // Not strictly needed if profileData is up-to-date

        const currentUserProfile = currentUserDocSnap.data();
        // const otherUserProfile = otherUserDocSnap.data(); // Or use profileData for the viewed user

        const chatDataToSave = {
            users: sortedUserIds, // Crucial: ensure this array has exactly 2 string UIDs
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
            }
        };

        // --- CRITICAL LOGS FOR DEBUGGING THE RULE ---
        console.log("--- Data being sent to Firestore for setDoc('chats/{chatId}') ---");
        console.log("Constructed Chat ID (Document Path):", chatId);
        console.log("Data (request.resource.data will be this):", JSON.stringify(chatDataToSave, null, 2));
        console.log("Authenticated User UID (request.auth.uid will be this):", currentUserId);
        console.log("Is auth UID in chatDataToSave.users array?", chatDataToSave.users.includes(currentUserId));
        console.log("Size of chatDataToSave.users array:", chatDataToSave.users.length);
        // --- END CRITICAL LOGS ---

        await setDoc(chatDocRef, chatDataToSave); // Use setDoc to create with specific ID
        console.log("New chat document created successfully with ID:", finalChatId);

      } else {
        finalChatId = chatDocSnap.id; // Should be the same as constructed chatId
        console.log("Chat already exists with ID:", finalChatId);
      }

      console.log("Navigating to chatRoom with chatId:", finalChatId);
      router.push({ pathname: '/chatRoom', params: { chatId: finalChatId } }); // Path to app/chatRoom.tsx

    } catch (error: any) { // Catch any error, including permissions from setDoc
      console.error("Error in handleStartChat (could be Firestore operation or other): ", error);
      Alert.alert("Error Starting Chat", error.message || "Could not initiate chat. Please check permissions or try again.");
    } finally {
      setChatLoading(false);
    }
  };
  // --- End Start Chat Handler ---

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
        {displayData.email && (
          <View style={styles.userInfo}><Text style={styles.emailText}>Email:</Text><Text style={styles.emailValue} selectable={true}>{displayData.email}</Text></View>
        )}
        {profileUserId !== currentUser?.uid && ( // Only show Start Chat if not viewing own profile
          <TouchableOpacity
            style={[styles.chatButton, chatLoading && styles.buttonDisabled]}
            onPress={handleStartChat}
            disabled={chatLoading || !currentUser} // Also disable if current user is somehow null
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
      <Stack.Screen
        options={{
          headerShown: true,
          // Title is set dynamically in useEffect
          headerStyle: { backgroundColor: themeColors.darkGrey },
          headerTintColor: themeColors.textLight,
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