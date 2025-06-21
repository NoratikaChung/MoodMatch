import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert,
  TouchableOpacity, SafeAreaView, Image, ActivityIndicator, FlatList, ScrollView,
  Platform, StatusBar
} from 'react-native';
// `signOut` is no longer needed here, as it's moved to the settings page
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
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';
import PostCard, { Post as PostCardData } from '../../components/PostCard';

interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<PostCardData[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Effect to fetch profile data (UNCHANGED)
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

  // Effect to fetch user's posts (UNCHANGED)
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

  // The handleLogout function is removed from here as it's moved to the settings page.

  // These functions are kept as they are used by PostCard (UNCHANGED)
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

  // --- UPDATED: This function is now cleaner ---
  const renderProfileInfo = () => (
    <>
      <View style={styles.profilePicContainer}>
        {profile?.photoURL ? <Image source={{ uri: profile.photoURL }} style={styles.profilePic} /> : <View style={[styles.profilePic, styles.profilePicPlaceholder]}><Ionicons name="person" size={60} color={themeColors.textSecondary} /></View>}
      </View>
      <Text style={styles.displayName}>{profile?.displayName || 'Your Name'}</Text>
      <Text style={styles.username}>@{profile?.username || 'username'}</Text>
    </>
  );

  const renderPostsList = () => (
    <View style={styles.postsSection}>
      <Text style={styles.sectionTitle}>Your Posts</Text>
      {loadingPosts && userPosts.length === 0 && <ActivityIndicator color={themeColors.pink} style={{marginTop: 20}} />}
      {!loadingPosts && userPosts.length === 0 && (<Text style={styles.noPostsText}>You haven't created any posts yet.</Text>)}
      {userPosts.length > 0 && (
        <FlatList
          data={userPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.postCardWrapperProfile}>
              <PostCard
                post={item}
                currentUserId={user?.uid}
                showMenu={true}
                onDeletePost={handleDeleteConfirmation}
                onHidePost={handleHidePostAction}
              />
            </View>
          )}
          scrollEnabled={false}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />
      )}
    </View>
  );

  // Conditional rendering for loading/error/setup states (UNCHANGED)
  if (isLoadingGlobal) { /* ... your loading UI ... */ }
  if (error && !profile && !userPosts.length) { /* ... your error UI ... */ }
  if (!user) { /* ... your not logged in UI ... */ }
  if (needsSetup) { /* ... your setup profile UI ... */ }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper} >
      <SafeAreaView style={styles.safeArea}>
        {/* --- UPDATED: The header now contains a settings icon --- */}
        <AppHeader>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon} />{/* Left spacer to center the title */}
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.headerIcon}
              onPress={() => router.push({
                pathname: '/settings',
                params: {
                  currentUsername: profile?.username || '',
                  currentDisplayName: profile?.displayName || '',
                  currentPhotoURL: profile?.photoURL || '',
                  email: user?.email || ''
                }
              })}
            >
              <Ionicons name="menu-outline" size={32} color={themeColors.textLight} />
            </TouchableOpacity>
          </View>
        </AppHeader>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {renderProfileInfo()}
          {renderPostsList()}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  fullScreenLoader: { flex: 1, justifyContent: 'center', alignItems: 'center'},
  scrollContainer: { alignItems: 'center', paddingHorizontal: 0, paddingBottom: 40, paddingTop: 20 },
  // --- NEW STYLES for the updated header ---
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  headerTitle: { color: themeColors.textLight, fontSize: 22, fontWeight: 'bold' },
  headerIcon: { width: 40, alignItems: 'center' },
  // --- END OF NEW STYLES ---
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', marginBottom: 20, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, alignSelf: 'center' },
  profilePic: { width: '100%', height: '100%' },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5, textAlign: 'center' },
  username: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 25, textAlign: 'center' },
  // --- REMOVED unused styles for buttons and user info box ---
  infoText: { fontSize: 18, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center' },
  errorText: { fontSize: 16, color: themeColors.errorRed, marginTop: 50, textAlign: 'center', paddingHorizontal: 15 },
  setupContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 50 },
  setupText: { fontSize: 24, fontWeight: '600', color: themeColors.textLight, marginBottom: 10 },
  setupSubText: { fontSize: 16, color: themeColors.textSecondary, marginBottom: 30, textAlign: 'center' },
  setupButton: { marginTop: 10, paddingHorizontal: 40, paddingVertical: 15, backgroundColor: themeColors.pink, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, marginBottom: 40 },
  setupButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  logoutButtonSmall: { marginTop: 0, paddingHorizontal: 25, paddingVertical: 10, backgroundColor: 'transparent', borderColor: themeColors.grey, borderWidth: 1, borderRadius: 20 },
  postsSection: { marginTop: 20, width: '100%' },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: themeColors.textLight, marginBottom: 15, paddingHorizontal: 15 },
  noPostsText: { fontSize: 15, color: themeColors.textSecondary, textAlign: 'center', marginTop: 20 },
  postCardWrapperProfile: { marginBottom: 15, marginHorizontal: 10, borderRadius: 10, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
});