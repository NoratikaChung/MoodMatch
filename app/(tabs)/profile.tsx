// File: app/(tabs)/profile.tsx (Corrected confirmAndDeletePost definition)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, // Keep Alert for delete confirmation
  TouchableOpacity, SafeAreaView, Image, ActivityIndicator, FlatList, ScrollView,
  Platform, StatusBar
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot, // Keep for profile updates
  query,
  where,
  collection,
  orderBy,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useRouter, Link, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

// --- ADD Popup Menu Imports ---
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
// MenuProvider should be in your app/_layout.tsx

// Interface for user profile data from Firestore
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}

// Interface for a Post document
interface Post {
  id: string; // Firestore document ID
  userId: string;
  username: string; // Denormalized
  userProfileImageUrl: string | null; // Denormalized
  imageUrl: string;
  caption: string | null;
  song: {
    id: string;
    name: string;
    artists: string[]; // Kept as array
    albumImageUrl: string | null;
    previewUrl: string | null; // Keep if you might play it from profile
  } | null;
  createdAt: any; // Firestore Timestamp, will be object with toDate() method
  likesCount?: number;
  commentsCount?: number;
}


export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Effect to fetch profile data in real-time
  useEffect(() => {
    if (!user) {
      setLoadingProfile(false); setProfile(null); setUserPosts([]); setLoadingPosts(false); return;
    }
    setLoadingProfile(true); setError(null);
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) { setProfile(docSnap.data() as UserProfile); }
      else { setProfile(null); }
      setLoadingProfile(false);
    }, (err) => {
      console.error("Error fetching profile:", err); setError("Failed to load profile."); setLoadingProfile(false);
    });
    return () => unsubscribeProfile();
  }, [user]);


  // Effect to fetch user's posts
  useEffect(() => {
    if (!user) {
      setUserPosts([]); setLoadingPosts(false); return;
    }
    setLoadingPosts(true); setError(null);
    const postsQuery = query(
      collection(db, "posts"), where("userId", "==", user.uid), orderBy("createdAt", "desc")
    );
    const unsubscribePosts = onSnapshot(postsQuery, (querySnapshot) => {
      const postsData: Post[] = [];
      querySnapshot.forEach((doc) => { postsData.push({ id: doc.id, ...doc.data() } as Post); });
      setUserPosts(postsData); setLoadingPosts(false);
    }, (err) => {
      console.error("Error fetching user posts:", err); setError(prevError => prevError || "Failed to load your posts."); setLoadingPosts(false);
    });
    return () => { unsubscribePosts(); };
  }, [user]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  // --- CORRECTED PLACEMENT: Define confirmAndDeletePost as a const function ---
  const confirmAndDeletePost = (postId: string) => {
    console.log("--- confirmAndDeletePost CALLED with postId:", postId);
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            console.log("Alert 'Delete' button pressed. Attempting to delete post ID from Firestore:", postId);
            try {
              await deleteDoc(doc(db, "posts", postId));
              console.log("Firestore deleteDoc successful for postId:", postId);
              Alert.alert("Post Deleted", "Your post has been removed.");
            } catch (e: any) {
              console.error("Error calling deleteDoc from Firestore:", e);
              Alert.alert("Error", `Could not delete post: ${e.message}`);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  // --- END CORRECTION ---

  const handleHidePost = (postId: string) => {
    console.log("Hide post action for post ID:", postId);
    Alert.alert("Hide Post", "This functionality will be implemented later.");
  };

  const isLoadingGlobal = loadingProfile && !profile;
  const needsSetup = user && !loadingProfile && (!profile || !profile.username);

  const renderProfileInfo = () => (
    <>
      <View style={styles.profilePicContainer}>
        {profile?.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={styles.profilePic} />
        ) : (
          <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
            <Ionicons name="person" size={60} color={themeColors.textSecondary} />
          </View>
        )}
      </View>
      <Text style={styles.displayName}>{profile?.displayName || 'Your Name'}</Text>
      <Text style={styles.username}>@{profile?.username || 'username'}</Text>
      <View style={styles.userInfo}>
        <Text style={styles.emailText}>Email:</Text>
        <Text style={styles.emailValue} selectable={true}>{user?.email}</Text>
      </View>
      <Link href={{ pathname: "/profile-edit", params: { mode: 'edit', currentUsername: profile?.username || '', currentDisplayName: profile?.displayName || '', currentPhotoURL: profile?.photoURL || '' }}} asChild>
        <TouchableOpacity style={styles.editButton}>
            <Ionicons name="pencil" size={18} color={themeColors.textLight} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </Link>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </>
  );

  const renderPostsGrid = () => (
    <View style={styles.postsSection}>
      <Text style={styles.sectionTitle}>Your Creative Posts</Text>
      {loadingPosts && userPosts.length === 0 && <ActivityIndicator color={themeColors.pink} style={{marginTop: 20}} />}
      {!loadingPosts && userPosts.length === 0 && (
        <Text style={styles.noPostsText}>You haven't created any posts yet.</Text>
      )}
      {userPosts.length > 0 && (
        <FlatList
          data={userPosts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.postsGridRow}
          renderItem={({ item }) => (
            <View style={styles.postItemContainer}>
              <Image source={{ uri: item.imageUrl }} style={styles.postImageThumbnail} />
              <Menu style={styles.postMenuTriggerContainer}>
                <MenuTrigger style={styles.postMenuTriggerButton}>
                  <Ionicons name="ellipsis-vertical" size={24} color={themeColors.textLight} />
                </MenuTrigger>
                <MenuOptions customStyles={menuOptionsStyles}>
                  <MenuOption onSelect={() => handleHidePost(item.id)} style={styles.menuOption}>
                    <Text style={styles.menuOptionText}>Hide</Text>
                  </MenuOption>
                  <MenuOption onSelect={() => confirmAndDeletePost(item.id)} style={styles.menuOption}>
                    <Text style={[styles.menuOptionText, styles.deleteOptionText]}>Delete</Text>
                  </MenuOption>
                </MenuOptions>
              </Menu>
            </View>
          )}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );

  // --- Conditional Rendering for loading/error/setup ---
  if (isLoadingGlobal) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
        <ActivityIndicator size="large" color={themeColors.pink} />
      </LinearGradient>
    );
  }

  if (error && !profile && !userPosts.length) { // Show error if profile loading failed critically
     return (
        <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
            <Text style={styles.errorText}>{error}</Text>
            {/* You might want a retry button here */}
        </LinearGradient>
     );
  }

  if (!user) { // User logged out or auth state not determined yet by RootLayout
    return (
        <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
            <Text style={styles.infoText}>Not logged in.</Text>
        </LinearGradient>
    );
  }

  if (needsSetup) {
    // Prompt to Setup Profile
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
        <SafeAreaView style={styles.safeArea}>
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
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Display Existing Profile and Posts
  return (
    <LinearGradient
      colors={themeColors.backgroundGradient}
      style={styles.gradientWrapper}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Profile</Text>
          {renderProfileInfo()}
          {renderPostsGrid()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// --- Styles for Popup Menu (Add or Merge with existing styles) ---
// These styles are for the react-native-popup-menu library
const menuOptionsStyles = {
  optionsContainer: {
    backgroundColor: themeColors.darkGrey,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 30, // Adjust as needed so it appears below the trigger icon
    width: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  // optionWrapper: {}, // Individual <MenuOption> style prop can be used instead
  // optionText: {}, // Style text directly inside <MenuOption>
};

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1, },
  safeArea: { flex: 1, },
  fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center'},
  scrollContainer: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 40, },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, color: themeColors.textLight, textAlign: 'center', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, },
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 20, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, },
  profilePic: { width: '100%', height: '100%', },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center', },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5, textAlign: 'center',},
  username: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 25, textAlign: 'center', },
  userInfo: { alignItems: 'center', marginBottom: 30, backgroundColor: themeColors.darkGrey, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, width: '90%', maxWidth: 400, alignSelf: 'center' },
  emailText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 3, },
  emailValue: { fontSize: 15, fontWeight: '500', color: themeColors.textLight, },
  editButton: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 25, paddingVertical: 12, backgroundColor: themeColors.blue, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 15, },
  editButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', marginLeft: 8, },
  logoutButton: { marginTop: 10, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, },
  logoutButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  infoText: { fontSize: 18, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center', },
  errorText: { fontSize: 16, color: themeColors.errorRed, marginTop: 50, textAlign: 'center', paddingHorizontal: 15, },
  setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 50, },
  setupText: { fontSize: 24, fontWeight: '600', color: themeColors.textLight, marginBottom: 10, },
  setupSubText: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 30, textAlign: 'center', },
  setupButton: { marginTop: 10, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 40, },
  setupButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  logoutButtonSmall: { marginTop: 0, paddingHorizontal: 25, paddingVertical: 10, backgroundColor: 'transparent', borderColor: themeColors.grey, borderWidth: 1, borderRadius: 20, },
  postsSection: { marginTop: 30, width: '100%', },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: themeColors.textLight, marginBottom: 15, alignSelf: 'flex-start', },
  noPostsText: { fontSize: 15, color: themeColors.textSecondary, textAlign: 'center', marginTop: 20, },
  postsGridRow: { justifyContent: 'space-between', marginBottom: 10, },
  postItemContainer: { backgroundColor: themeColors.darkGrey, borderRadius: 8, width: '48.5%', overflow: 'hidden', position: 'relative', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, },
  postImageThumbnail: { width: '100%', aspectRatio: 1, },

  // --- Styles for Popup Menu ---
  postMenuTriggerContainer: { // Container for the Menu component
    position: 'absolute',
    top: 3,
    right: 3,
    zIndex: 10, // Ensure it's clickable over the image
  },
  postMenuTriggerButton: { // The actual touchable area for the icon
    padding: 8, // Make it easier to tap
  },
  menuOption: { // Style for individual option container in the dropdown
    paddingVertical: 12,
    paddingHorizontal: 15,
    // backgroundColor: themeColors.darkGrey, // Can be set here or on MenuOptions
  },
  menuOptionText: {
    fontSize: 16,
    color: themeColors.textLight,
  },
  deleteOptionText: {
    color: themeColors.errorRed,
    // fontWeight: 'bold', // Optional
  },
  // menuSeparator: { // Example for a separator line if you want one
  //   height: StyleSheet.hairlineWidth,
  //   backgroundColor: themeColors.grey,
  //   marginVertical: 5,
  // },
});