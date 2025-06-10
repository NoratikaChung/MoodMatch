// app/(tabs)/community.tsx (Refined Conditional Rendering for Posts Grid)

import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Dimensions, Image,
  Platform, StatusBar, Alert, TextInput
} from 'react-native';
import { collection, query, where, getDocs, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db, auth } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

// Post interface (ensure consistency with other files like PostCard.tsx)
interface Post {
  id: string;
  userId: string;
  username: string;
  userProfileImageUrl: string | null;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  caption: string | null;
  song: {
    id: string;
    name: string;
    artists: string[];
    albumImageUrl: string | null;
    previewUrl: string | null;
  } | null;
  createdAt: any; // Firestore Timestamp
  likesCount?: number;
  likedBy?: string[];
  commentsCount?: number;
  overallModerationStatus?: 'approved' | 'pending' | 'rejected';
}

// User interface for search results
interface UserSearchResult {
  id: string;
  username: string;
  displayName?: string;
  photoURL?: string;
}

const NUM_COLUMNS = 3;
const screenWidth = Dimensions.get('window').width;
const spacing = 2; // Spacing between items AND on the sides of the grid
const totalHorizontalSpacing = spacing * (NUM_COLUMNS + 1);
const itemSize = (screenWidth - totalHorizontalSpacing) / NUM_COLUMNS;


export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null); // For post fetching errors
  const router = useRouter();

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch Community Posts
  useEffect(() => {
    setIsLoadingPosts(true);
    setError(null);
    const postsQuery = query(
      collection(db, "posts"),
      // where("overallModerationStatus", "==", "approved"), // UNCOMMENT once moderation is active & index created
      orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(postsQuery, (querySnapshot) => {
      const fetchedPosts: Post[] = [];
      querySnapshot.forEach((doc) => {
        fetchedPosts.push({ id: doc.id, ...doc.data() } as Post);
      });
      setPosts(fetchedPosts);
      setIsLoadingPosts(false);
    }, (err) => {
      console.error("Error fetching community posts:", err);
      setError("Failed to load posts. Please try again later.");
      setIsLoadingPosts(false);
    });
    return () => unsubscribe();
  }, []);

  const handleUserSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery === '') { setSearchResults([]); setHasSearched(false); return; }
    setIsLoadingSearch(true); setHasSearched(true); setSearchResults([]);
    try {
      const usersRef = collection(db, 'users');
      const lowerCaseQuery = trimmedQuery.toLowerCase();
      const q = query( usersRef, where('username', '>=', lowerCaseQuery), where('username', '<=', lowerCaseQuery + '\uf8ff'), limit(10) );
      const querySnapshot = await getDocs(q);
      const users: UserSearchResult[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push({ id: doc.id, username: data.username || 'N/A', displayName: data.displayName, photoURL: data.photoURL });
      });
      setSearchResults(users);
    } catch (e: any) { // Added 'any' type for error
        console.error("Error searching users: ", e);
        Alert.alert("Search Error", e.message || "Could not perform search.");
    }
    finally { setIsLoadingSearch(false); }
  };

  const navigateToUserProfile = (userId: string) => {
    router.push({ pathname: '/(tabs)/userProfile', params: { userId: userId } });
  };

  const navigateToPostDetail = (postId: string) => {
    console.log("Navigating to post detail for ID:", postId);
    // Navigate to the dynamic route, passing the postId as the 'id' parameter
    router.push(`/post/${postId}`);
  };

  const renderPostGridItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
        style={styles.gridItem}
        onPress={() => navigateToPostDetail(item.id)}
        activeOpacity={0.8}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.gridImage} resizeMode="cover" />
    </TouchableOpacity>
  );

  const renderUserSearchItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity onPress={() => navigateToUserProfile(item.id)} style={styles.searchResultItem}>
      {item.photoURL ?
        <Image source={{ uri: item.photoURL }} style={styles.searchAvatar} /> :
        <View style={[styles.searchAvatar, styles.searchAvatarPlaceholder]}><Ionicons name="person" color={themeColors.textSecondary} size={20}/></View>
      }
      <View>
        <Text style={styles.searchUsername}>{item.username}</Text>
        {item.displayName && <Text style={styles.searchDisplayName}>{item.displayName}</Text>}
      </View>
    </TouchableOpacity>
  );

  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) { // Means we are closing search
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
    }
  };

  // For rendering loading placeholders for the grid
  const renderGridPlaceholders = () => {
    return Array.from({ length: 9 }).map((_, index) => ( // Show e.g. 3 rows of placeholders
      <View key={`placeholder-${index}`} style={[styles.gridItem, styles.gridItemPlaceholder]} />
    ));
  };


  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        {!isSearchActive ? (
          <View style={styles.header}>
            <Text style={styles.title}>Creative Community</Text>
            <TouchableOpacity onPress={toggleSearch} style={styles.searchIconContainer}>
              <Ionicons name="search-outline" size={28} color={themeColors.textLight} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.searchHeader}>
            <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} style={styles.searchInputIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by username..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleUserSearch}
                    autoCapitalize="none"
                    returnKeyType="search"
                    autoFocus={true}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchButton}>
                        <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>
            <TouchableOpacity onPress={toggleSearch}>
              <Text style={styles.cancelSearchText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {isSearchActive ? (
            <View style={styles.searchResultsContainer}>
                {isLoadingSearch && <View style={styles.centeredMessageContainer}><ActivityIndicator color={themeColors.pink} size="large" /></View>}
                {!isLoadingSearch && hasSearched && searchResults.length === 0 && (
                    <View style={styles.centeredMessageContainer}><Text style={styles.infoText}>No users found for "{searchQuery}".</Text></View>
                )}
                {!isLoadingSearch && searchResults.length > 0 && (
                    <FlatList
                        data={searchResults}
                        renderItem={renderUserSearchItem}
                        keyExtractor={(item) => item.id}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </View>
        ) : ( // Displaying Posts Grid
            <>
                {isLoadingPosts && posts.length === 0 && (
                    <FlatList // Show placeholder grid while loading
                        data={Array.from({ length: 9 })}
                        renderItem={({index}) => <View key={`placeholder-${index}`} style={[styles.gridItem, styles.gridItemPlaceholder]} />}
                        keyExtractor={(item, index) => `placeholder-${index}`}
                        numColumns={NUM_COLUMNS}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
                {!isLoadingPosts && error && (
                    <View style={styles.centeredMessageContainer}><Text style={styles.errorText}>{error}</Text></View>
                )}
                {!isLoadingPosts && !error && posts.length === 0 && (
                    <View style={styles.centeredMessageContainer}><Text style={styles.infoText}>No posts yet. Be the first to share!</Text></View>
                )}
                {!isLoadingPosts && posts.length > 0 && (
                    <FlatList
                        data={posts}
                        renderItem={renderPostGridItem}
                        keyExtractor={(item) => item.id}
                        numColumns={NUM_COLUMNS}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12,},
  title: { fontSize: 24, fontWeight: 'bold', color: themeColors.textLight, },
  searchIconContainer: { padding: 8, },
  centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20,},
  errorText: { color: themeColors.errorRed, fontSize: 16, textAlign: 'center', },
  infoText: { color: themeColors.textSecondary, fontSize: 16, textAlign: 'center', },
  gridContainer: {
    paddingHorizontal: spacing, // This applies spacing on the left of the first column and right of the last
    paddingTop: spacing,
    // alignItems: 'flex-start', // Not needed if items handle their own margins for spacing
  },
  gridItem: {
    width: itemSize,
    height: itemSize,
    // margin is applied to create space between items
    marginLeft: spacing / NUM_COLUMNS / 2, // Distribute half of inter-item spacing
    marginRight: spacing / NUM_COLUMNS / 2,
    marginBottom: spacing, // Vertical spacing between rows
    backgroundColor: themeColors.darkGrey,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridItemPlaceholder: {
    backgroundColor: themeColors.darkGrey,
    opacity: 0.5,
  },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.grey, backgroundColor: themeColors.backgroundGradient[1], },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.darkGrey, borderRadius: 10, paddingHorizontal: 10, marginRight: 10, },
  searchInputIcon: { marginRight: 8, },
  searchInput: { flex: 1, height: 40, color: themeColors.textLight, fontSize: 16, },
  clearSearchButton: { padding: 5, },
  cancelSearchText: { color: themeColors.pink, fontSize: 16, fontWeight: '500', },
  searchResultsContainer: { flex: 1, paddingHorizontal: 0, }, // Let items handle their own padding
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.grey, paddingHorizontal: 15, }, // Added paddingHorizontal
  searchAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: themeColors.grey, },
  searchAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center', },
  searchUsername: { color: themeColors.textLight, fontSize: 16, fontWeight: '500', },
  searchDisplayName: { color: themeColors.textSecondary, fontSize: 14, },
});