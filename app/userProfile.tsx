import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, SafeAreaView,
  Image, ActivityIndicator, FlatList, Dimensions
} from 'react-native';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { User as FirebaseAuthUser } from 'firebase/auth';
import AppHeader from '../components/AppHeader';

interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}
interface Post {
  id: string;
  imageUrl: string;
}

const NUM_COLUMNS = 3;
const spacing = 2;
const itemSize = (Dimensions.get('window').width - (spacing * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string }>();
  const profileUserId = params.userId;

  const [currentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [headerTitle, setHeaderTitle] = useState('Loading...');

  // Effect to fetch profile data
  useEffect(() => {
    if (!profileUserId) {
      setError("User ID not provided."); setIsLoading(false); setHeaderTitle('Error'); return;
    }
    const userDocRef = doc(db, "users", profileUserId);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfileData(data);
        setHeaderTitle(data.username || data.displayName || 'User Profile');
      } else {
        setProfileData(null); setError("User profile not found."); setHeaderTitle('Not Found');
      }
      setIsLoading(false);
    }, (err) => {
      setError("Failed to load profile."); setIsLoading(false); setHeaderTitle('Error');
    });
    return () => unsubscribe();
  }, [profileUserId]);

  // Effect to fetch the user's posts
  useEffect(() => {
    if (!profileUserId) return;
    const postsQuery = query(
      collection(db, "posts"),
      where("userId", "==", profileUserId),
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(postsQuery, (querySnapshot) => {
      const posts: Post[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setUserPosts(posts);
    });
    return () => unsubscribe();
  }, [profileUserId]);

  // Your original handleStartChat function is preserved
  const handleStartChat = async () => {
    if (!currentUser || !profileUserId || currentUser.uid === profileUserId) {
      Alert.alert("Error", !currentUser ? "Please log in." : "Cannot start chat."); return;
    }
    setChatLoading(true);
    try {
      const sortedUserIds = [currentUser.uid, profileUserId].sort();
      const chatId = sortedUserIds.join('_');
      const chatDocRef = doc(db, 'chats', chatId);
      const chatDocSnap = await getDoc(chatDocRef);
      if (!chatDocSnap.exists()) {
        const currentUserDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const currentUserProfile = currentUserDoc.data();
        await setDoc(chatDocRef, {
          users: sortedUserIds, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: null,
          userNames: { [currentUser.uid]: currentUserProfile?.username || 'User', [profileUserId]: profileData?.username || 'User', },
          userPhotos: { [currentUser.uid]: currentUserProfile?.photoURL || null, [profileUserId]: profileData?.photoURL || null, },
        });
      }
      router.push({ pathname: '/chatRoom', params: { chatId } });
    } catch (error: any) {
      Alert.alert("Error Starting Chat", error.message);
    } finally {
      setChatLoading(false);
    }
  };

  const renderPostGridItem = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.gridItem} onPress={() => router.push(`/post/${item.id}`)}>
      <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
    </TouchableOpacity>
  );

  const renderHeaderContent = () => {
    if (isLoading) {
      return <ActivityIndicator color={themeColors.pink} style={{ marginVertical: 50 }} />;
    }
    if (!profileData) {
      return <Text style={styles.infoText}>User not found.</Text>;
    }
    return (
      <View style={styles.profileHeader}>
        <View style={styles.profilePicContainer}>
          {profileData.photoURL ? <Image source={{ uri: profileData.photoURL }} style={styles.profilePic} /> : <View style={[styles.profilePic, styles.profilePicPlaceholder]}><Ionicons name="person" size={60} color={themeColors.textSecondary} /></View>}
        </View>
        <Text style={styles.displayName}>{profileData.displayName || 'User'}</Text>
        <Text style={styles.username}>@{profileData.username || 'username'}</Text>
        {profileUserId !== currentUser?.uid && (
          <TouchableOpacity style={[styles.chatButton, chatLoading && styles.buttonDisabled]} onPress={handleStartChat} disabled={chatLoading || !currentUser}>
            {chatLoading ? <ActivityIndicator color={themeColors.textLight} size="small" /> : <><Ionicons name="chatbubbles-outline" size={18} color={themeColors.textLight} style={{ marginRight: 8 }} /><Text style={styles.buttonText}>Start Chat</Text></>}
          </TouchableOpacity>
        )}
        {/* --- THIS IS THE NEW "POSTS" TITLE --- */}
        <Text style={styles.sectionTitle}>Posts</Text>
      </View>
    );
  };

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper} >
      <SafeAreaView style={styles.safeArea}>
        <AppHeader>
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}><Ionicons name="arrow-back" size={24} color={themeColors.textLight} /></TouchableOpacity>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <View style={styles.headerIcon} />
          </View>
        </AppHeader>

        <FlatList
          ListHeaderComponent={renderHeaderContent}
          data={userPosts}
          renderItem={renderPostGridItem}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={!isLoading ? <Text style={styles.infoText}>This user has no posts yet.</Text> : null}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  headerTitle: { color: themeColors.textLight, fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  headerIcon: { padding: 5, width: 40, alignItems: 'center' },
  profileHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 10 },
  profilePicContainer: { width: 120, height: 120, borderRadius: 60, marginBottom: 15, borderWidth: 3, borderColor: themeColors.pink },
  profilePic: { width: '100%', height: '100%', borderRadius: 60 },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.darkGrey, borderRadius: 60 },
  displayName: { fontSize: 22, fontWeight: '600', color: themeColors.textLight, marginBottom: 5 },
  username: { fontSize: 16, color: themeColors.textSecondary },
  chatButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 30, paddingVertical: 12, backgroundColor: themeColors.blue, borderRadius: 25 },
  buttonDisabled: { backgroundColor: themeColors.grey },
  buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  infoText: { fontSize: 16, color: themeColors.textSecondary, marginTop: 50, textAlign: 'center' },
  // --- NEW STYLE FOR THE "POSTS" TITLE ---
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: themeColors.textLight,
    marginTop: 30, // Add space above the title
    marginBottom: 10, // Add space below the title
    marginLeft: 20, // Align to the left
    alignSelf: 'flex-start', // Align to the left
    paddingHorizontal: spacing, // Match grid horizontal padding
  },
  // Grid Styles
  gridContainer: {
    paddingHorizontal: spacing,
  },
  gridItem: {
    width: itemSize,
    height: itemSize,
    margin: spacing / 2,
    backgroundColor: themeColors.darkGrey,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
});