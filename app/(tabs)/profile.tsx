// File: app/(tabs)/profile.tsx (Full code with PostCard integration and its menu actions)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert,
  TouchableOpacity, SafeAreaView, Image, ActivityIndicator, FlatList, ScrollView,
  Platform, StatusBar
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  doc,
  getDoc, // Re-added getDoc as it might be used (though onSnapshot is primary for profile)
  onSnapshot,
  query,
  where,
  collection,
  orderBy,
  deleteDoc,
  // Timestamp // Not strictly needed to import if using 'any' for createdAt type
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useRouter, Link, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

// Import PostCard and its Post interface (adjust path if necessary)
// Assuming PostCard.tsx is in app/components/
import PostCard, { Post as PostCardData } from '../../components/PostCard';

// Interface for user profile data from Firestore
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}
// The Post interface is now imported as PostCardData

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<PostCardData[]>([]); // Use imported PostCardData type
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
    setLoadingPosts(true); setError(null); // Clear post-specific errors too
    const postsQuery = query(
      collection(db, "posts"), where("userId", "==", user.uid), orderBy("createdAt", "desc")
    );
    const unsubscribePosts = onSnapshot(postsQuery, (querySnapshot) => {
      const postsData: PostCardData[] = [];
      querySnapshot.forEach((doc) => { postsData.push({ id: doc.id, ...doc.data() } as PostCardData); });
      setUserPosts(postsData); setLoadingPosts(false);
    }, (err) => {
      console.error("Error fetching user posts:", err);
      setError(prevError => prevError || "Failed to load your posts."); // Append or set post error
      setLoadingPosts(false);
    });
    return () => { unsubscribePosts(); };
  }, [user]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Navigation to login is typically handled by RootLayout observer
    } catch (error: any) {
      console.error('Sign out error:', error);
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  // This function shows the confirmation alert and then deletes if confirmed
  const handleDeleteConfirmation = (postId: string) => {
    console.log("--- handleDeleteConfirmation CALLED for postId:", postId);
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

  const handleHidePostAction = (postId: string) => {
    // Placeholder for future hide functionality
    console.log("Hide post action triggered for post ID:", postId);
    Alert.alert("Hide Post", "This functionality will be implemented later.");
  };

  const isLoadingGlobal = loadingProfile && !profile; // True if profile is still loading and not yet available
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

  const renderPostsList = () => ( // Renamed from renderPostsGrid for clarity if using single column
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
          numColumns={1} // Displaying full PostCards, so 1 column
          renderItem={({ item }) => (
            <View style={styles.postCardWrapperProfile}>
              <PostCard
                post={item}
                currentUserId={user?.uid} // Pass current user's ID
                showMenu={true} // Tell PostCard to show its menu on profile
                onDeletePost={handleDeleteConfirmation} // Pass the delete handler
                onHidePost={handleHidePostAction}       // Pass the hide handler
                onPressPost={(postId) => {
                  // Later, navigate to a detailed post screen:
                  // router.push(`/post/${postId}`); // Assuming you have a route like app/post/[id].tsx
                  Alert.alert("View Post Details", `Would navigate to details for post: ${postId}`);
                }}
                onPressUsername={(userId) => {
                  // On own profile, clicking own username might not do anything or refresh
                  // On a community feed, this would navigate to that user's profile
                  if (userId !== user?.uid) { // Example if used elsewhere
                    // router.push({ pathname: '/(tabs)/userProfile', params: { userId: userId }});
                  }
                  console.log("Username pressed on card:", userId);
                }}
                // Add other necessary handlers for like, comment, share, mute if PostCard needs them
                // isCurrentlyPlayingAudio={/* manage this state if PostCard plays audio */}
                // isMuted={/* manage this state */}
                // onPressLike={...}
                // onPressComment={...}
              />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
          ListFooterComponent={<View style={{ height: 20 }} />} // Some padding at the end of the list
        />
      )}
    </View>
  );

  // --- Conditional Rendering for initial loading/error/setup ---
  if (isLoadingGlobal) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
        <ActivityIndicator size="large" color={themeColors.pink} />
      </LinearGradient>
    );
  }

  if (error && !profile && !userPosts.length) {
     return (
        <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
            <Text style={styles.errorText}>{error}</Text>
        </LinearGradient>
     );
  }

  if (!user) {
    return (
        <LinearGradient colors={themeColors.backgroundGradient} style={styles.fullScreenLoader}>
            <Text style={styles.infoText}>Not logged in.</Text>
        </LinearGradient>
    );
  }

  if (needsSetup) {
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
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled" // Good for any potential inputs later
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Profile</Text>
          {renderProfileInfo()}
          {renderPostsList()} {/* Changed from renderPostsGrid to renderPostsList */}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// --- Styles ---
// menuOptionsStyles is now defined INSIDE PostCard.tsx as it's specific to its menu
// const menuOptionsStyles = { ... };

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1, },
  safeArea: { flex: 1, },
  fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center'},
  scrollContainer: { alignItems: 'center', paddingHorizontal: 0, paddingBottom: 40, }, // Changed paddingHorizontal for full-width cards
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, color: themeColors.textLight, textAlign: 'center', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, },
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 20, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, alignSelf: 'center' },
  profilePic: { width: '100%', height: '100%', },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center', },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5, textAlign: 'center',},
  username: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 25, textAlign: 'center', },
  userInfo: { alignItems: 'center', marginBottom: 30, backgroundColor: themeColors.darkGrey, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, width: '90%', maxWidth: 400, alignSelf: 'center' },
  emailText: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 3, },
  emailValue: { fontSize: 15, fontWeight: '500', color: themeColors.textLight, },
  editButton: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingHorizontal: 25, paddingVertical: 12, backgroundColor: themeColors.blue, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 15, alignSelf: 'center' },
  editButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', marginLeft: 8, },
  logoutButton: { marginTop: 10, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, alignSelf: 'center' },
  logoutButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  infoText: { fontSize: 18, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center', },
  errorText: { fontSize: 16, color: themeColors.errorRed, marginTop: 50, textAlign: 'center', paddingHorizontal: 15, },
  setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 50, },
  setupText: { fontSize: 24, fontWeight: '600', color: themeColors.textLight, marginBottom: 10, },
  setupSubText: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 30, textAlign: 'center', },
  setupButton: { marginTop: 10, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 40, },
  setupButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  logoutButtonSmall: { marginTop: 0, paddingHorizontal: 25, paddingVertical: 10, backgroundColor: 'transparent', borderColor: themeColors.grey, borderWidth: 1, borderRadius: 20, },

  postsSection: {
    marginTop: 20, // Reduced margin
    width: '100%', // Take full width
    // paddingHorizontal: 10, // Padding handled by PostCard or globally if needed
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: themeColors.textLight,
    marginBottom: 15,
    paddingHorizontal: 15, // Add some horizontal padding for the title
    // alignSelf: 'flex-start', // Default
  },
  noPostsText: {
    fontSize: 15,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  postCardWrapperProfile: { // Wrapper for each PostCard
    marginBottom: 15, // Space between cards
    // The PostCard itself will have its background and border radius
  },
  postSeparator: { // Used by FlatList ItemSeparatorComponent
    height: 15, // This creates the space between PostCards
  },
  // Removed grid-specific styles like postsGridRow, postItemContainer, etc.
  // as PostCard now handles its own full-width display.
  // The menu styles (postMenuTriggerContainer, menuOption, etc.) are now
  // expected to be defined WITHIN PostCard.tsx if PostCard renders its own menu.
});