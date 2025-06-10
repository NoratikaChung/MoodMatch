// File: app/(tabs)/profile.tsx (Adding horizontal margin to PostCard wrappers)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert,
  TouchableOpacity, SafeAreaView, Image, ActivityIndicator, FlatList, ScrollView,
  Platform, StatusBar
} from 'react-native';
import { signOut } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  query,
  where,
  collection,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useRouter, Link, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu'; // Keep Menu imports

// Import PostCard and its Post interface (adjust path if necessary)
import PostCard, { Post as PostCardData } from '../../components/PostCard';

// Interface for user profile data
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}
// PostCardData interface is imported from PostCard.tsx

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<PostCardData[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Effect to fetch profile data
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
      const postsData: PostCardData[] = [];
      querySnapshot.forEach((doc) => { postsData.push({ id: doc.id, ...doc.data() } as PostCardData); });
      setUserPosts(postsData); setLoadingPosts(false);
    }, (err) => {
      console.error("Error fetching user posts:", err); setError(prevError => prevError || "Failed to load your posts."); setLoadingPosts(false);
    });
    return () => { unsubscribePosts(); };
  }, [user]);

  const handleLogout = async () => {
    try { await signOut(auth); }
    catch (error: any) { console.error('Sign out error:', error); Alert.alert('Logout Error', error.message || 'Failed to sign out.'); }
  };

  const handleDeleteConfirmation = (postId: string) => {
    Alert.alert( "Delete Post", "Are you sure you want to delete this post? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", postId));
              Alert.alert("Post Deleted", "Your post has been removed.");
            } catch (e: any) { console.error("Error deleting post:", e); Alert.alert("Error", `Could not delete post: ${e.message}`); }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleHidePostAction = (postId: string) => {
    Alert.alert("Hide Post", "This functionality will be implemented later.");
  };

  const isLoadingGlobal = loadingProfile && !profile;
  const needsSetup = user && !loadingProfile && (!profile || !profile.username);

  const renderProfileInfo = () => (
    <>
      <View style={styles.profilePicContainer}>
        {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.profilePic} /> : <View style={[styles.profilePic, styles.profilePicPlaceholder]}><Ionicons name="person" size={60} color={themeColors.textSecondary} /></View>}
      </View>
      <Text style={styles.displayName}>{profile?.displayName || 'Your Name'}</Text>
      <Text style={styles.username}>@{profile?.username || 'username'}</Text>
      <View style={styles.userInfo}><Text style={styles.emailText}>Email:</Text><Text style={styles.emailValue} selectable={true}>{user?.email}</Text></View>
      <Link href={{ pathname: "/profile-edit", params: { mode: 'edit', currentUsername: profile?.username || '', currentDisplayName: profile?.displayName || '', currentPhotoURL: profile?.photoURL || '' }}} asChild>
        <TouchableOpacity style={styles.editButton}><Ionicons name="pencil" size={18} color={themeColors.textLight} /><Text style={styles.editButtonText}>Edit Profile</Text></TouchableOpacity>
      </Link>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Text style={styles.logoutButtonText}>Logout</Text></TouchableOpacity>
    </>
  );

  const renderPostsList = () => (
    <View style={styles.postsSection}>
      <Text style={styles.sectionTitle}>Your Creative Posts</Text>
      {loadingPosts && userPosts.length === 0 && <ActivityIndicator color={themeColors.pink} style={{marginTop: 20}} />}
      {!loadingPosts && userPosts.length === 0 && (<Text style={styles.noPostsText}>You haven't created any posts yet.</Text>)}
      {userPosts.length > 0 && (
        <FlatList
          data={userPosts}
          keyExtractor={(item) => item.id}
          numColumns={1} // Displaying full PostCards
          renderItem={({ item }) => (
            <View style={styles.postCardWrapperProfile}> {/* Wrapper for margins */}
              <PostCard
                post={item}
                currentUserId={user?.uid}
                showMenu={true} // Tell PostCard to show its menu
                onDeletePost={handleDeleteConfirmation} // Pass delete handler
                onHidePost={handleHidePostAction}       // Pass hide handler
                onPressPost={(postId) => Alert.alert("View Post Details", `Would navigate to details for post: ${postId}`)}
                onPressUsername={(userId) => { if (userId !== user?.uid) { Alert.alert("View Profile", `View user ${userId}`); }}}
                // Add other handlers like onPressLike, onPressComment as needed
              />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.postSeparator} />}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );

  if (isLoadingGlobal) { /* ... loading UI ... */ }
  if (error && !profile && !userPosts.length) { /* ... error UI ... */ }
  if (!user) { /* ... not logged in UI ... */ }
  if (needsSetup) { /* ... setup profile UI ... */ }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper} >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Profile</Text>
          {renderProfileInfo()}
          {renderPostsList()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Styles for Popup Menu used by PostCard (if PostCard defines its own styles, this might be redundant here)
// For clarity, if PostCard has its own menuOptionsStylesCard, this can be removed from profile.tsx
// const menuOptionsStyles = { ... };

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1, },
  safeArea: { flex: 1, },
  fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center'},
  scrollContainer: { alignItems: 'center', paddingHorizontal: 0, paddingBottom: 40, },
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
    marginTop: 20,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: themeColors.textLight,
    marginBottom: 15,
    paddingHorizontal: 15, // Give title some padding if cards have margin
  },
  noPostsText: {
    fontSize: 15,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  postCardWrapperProfile: {
    marginBottom: 15,
    marginHorizontal: 10, // <<< ADDED HORIZONTAL MARGIN
    borderRadius: 10,
    overflow: 'hidden',
    // PostCard itself will have a background color
    // Shadow can be applied here or on PostCard's container
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  postSeparator: { // For vertical space between full-width cards
    height: 15,
  },
  // Removed styles specific to the old grid item and menu, as PostCard handles its content
});