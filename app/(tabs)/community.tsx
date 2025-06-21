import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, SafeAreaView, Dimensions, Image,
  Platform, StatusBar, Alert, TextInput
} from 'react-native';
import { collection, query, where, getDocs, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { db } from '../../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

// <<< IMPORT YOUR REUSABLE HEADER COMPONENT >>>
import AppHeader from '../../components/AppHeader';

interface Post { id: string; userId: string; username: string; userProfileImageUrl: string | null; imageUrl: string; imageWidth?: number; imageHeight?: number; caption: string | null; song: any | null; createdAt: any; }
interface UserSearchResult { id: string; username: string; displayName?: string; photoURL?: string; }

const NUM_COLUMNS = 3;
const screenWidth = Dimensions.get('window').width;
const spacing = 2;
const itemSize = (screenWidth - (spacing * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

export default function CommunityScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Your original useEffect hook - UNCHANGED
  useEffect(() => {
    setIsLoadingPosts(true);
    setError(null);
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(postsQuery, (querySnapshot) => {
      const fetchedPosts: Post[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(fetchedPosts);
      setIsLoadingPosts(false);
    }, (err) => {
      console.error("Error fetching community posts:", err);
      setError("Failed to load posts. Please try again later.");
      setIsLoadingPosts(false);
    });
    return () => unsubscribe();
  }, []);

  // All your original functions - UNCHANGED
  const handleUserSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery === '') { setSearchResults([]); setHasSearched(false); return; }
    setIsLoadingSearch(true); setHasSearched(true); setSearchResults([]);
    try {
      const usersRef = collection(db, 'users');
      const lowerCaseQuery = trimmedQuery.toLowerCase();
      const q = query( usersRef, where('username', '>=', lowerCaseQuery), where('username', '<=', lowerCaseQuery + '\uf8ff'), limit(10) );
      const querySnapshot = await getDocs(q);
      const users: UserSearchResult[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserSearchResult));
      setSearchResults(users);
    } catch (e: any) {
        console.error("Error searching users: ", e);
        Alert.alert("Search Error", e.message || "Could not perform search.");
    } finally { setIsLoadingSearch(false); }
  };
  const navigateToUserProfile = (userId: string) => { router.push({ pathname: '/userProfile', params: { userId } }); };
  const navigateToPostDetail = (postId: string) => { router.push(`/post/${postId}`); };
  const renderPostGridItem = ({ item }: { item: Post }) => (
    <TouchableOpacity style={styles.gridItem} onPress={() => navigateToPostDetail(item.id)} activeOpacity={0.8}>
      <Image source={{ uri: item.imageUrl }} style={styles.gridImage} resizeMode="cover" />
    </TouchableOpacity>
  );
  const renderUserSearchItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity onPress={() => navigateToUserProfile(item.id)} style={styles.searchResultItem}>
      {item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.searchAvatar} /> : <View style={[styles.searchAvatar, styles.searchAvatarPlaceholder]}><Ionicons name="person" color={themeColors.textSecondary} size={20}/></View>}
      <View>
        <Text style={styles.searchUsername}>{item.username}</Text>
        {item.displayName && <Text style={styles.searchDisplayName}>{item.displayName}</Text>}
      </View>
    </TouchableOpacity>
  );
  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive);
    if (isSearchActive) { setSearchQuery(''); setSearchResults([]); setHasSearched(false); }
  };
  const renderGridPlaceholders = () => { /* This function from your original code is kept, though unused in this specific logic block, it's preserved */ };

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        {/* <<< The AppHeader now wraps your existing header logic >>> */}
        <AppHeader>
          {!isSearchActive ? (
            <View style={styles.headerContent}>
              <Text style={styles.title}>Creative Community</Text>
              <TouchableOpacity onPress={toggleSearch} style={styles.searchIconContainer}>
                <Ionicons name="search-outline" size={28} color={themeColors.textLight} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerContent}>
              <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color={themeColors.textSecondary} style={styles.searchInputIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by username..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleUserSearch}
                    autoCapitalize="none" returnKeyType="search" autoFocus={true}
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
        </AppHeader>

        {isSearchActive ? (
          // Your original Search Results View - UNCHANGED
          <View style={styles.searchResultsContainer}>
            {isLoadingSearch && <View style={styles.centeredMessageContainer}><ActivityIndicator color={themeColors.pink} size="large" /></View>}
            {!isLoadingSearch && hasSearched && searchResults.length === 0 && (
              <View style={styles.centeredMessageContainer}><Text style={styles.infoText}>No users found for "{searchQuery}".</Text></View>
            )}
            {!isLoadingSearch && searchResults.length > 0 && (
              <FlatList data={searchResults} renderItem={renderUserSearchItem} keyExtractor={(item) => item.id} />
            )}
          </View>
        ) : (
          // Your original Posts Grid View with all its conditional logic - UNCHANGED
          <>
            {isLoadingPosts && posts.length === 0 && (
              <FlatList data={Array.from({ length: 9 })}
                  renderItem={({index}) => <View key={`placeholder-${index}`} style={[styles.gridItem, styles.gridItemPlaceholder]} />}
                  keyExtractor={(item, index) => `placeholder-${index}`}
                  numColumns={NUM_COLUMNS} contentContainerStyle={styles.gridContainer}
              />
            )}
            {!isLoadingPosts && error && (
              <View style={styles.centeredMessageContainer}><Text style={styles.errorText}>{error}</Text></View>
            )}
            {!isLoadingPosts && !error && posts.length === 0 && (
              <View style={styles.centeredMessageContainer}><Text style={styles.infoText}>No posts yet. Be the first to share!</Text></View>
            )}
            {!isLoadingPosts && posts.length > 0 && (
              <FlatList data={posts} renderItem={renderPostGridItem} keyExtractor={(item) => item.id}
                  numColumns={NUM_COLUMNS} contentContainerStyle={styles.gridContainer}
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
  // <<< MODIFIED: Removed top padding as AppHeader handles it >>>
  safeArea: { flex: 1 },
  // This new style manages the layout *inside* the AppHeader
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  // <<< REMOVED: Old `header` and `searchHeader` styles are no longer needed >>>
  title: { fontSize: 22, fontWeight: 'bold', color: themeColors.textLight },
  searchIconContainer: { padding: 5 },
  centeredMessageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: themeColors.errorRed, fontSize: 16, textAlign: 'center' },
  infoText: { color: themeColors.textSecondary, fontSize: 16, textAlign: 'center' },
  gridContainer: { paddingHorizontal: spacing },
  gridItem: { width: itemSize, height: itemSize, marginHorizontal: 0, marginBottom: spacing, backgroundColor: themeColors.darkGrey, left: spacing/2 }, // Adjusted for cleaner grid
  gridItemPlaceholder: { backgroundColor: themeColors.darkGrey, opacity: 0.5 },
  gridImage: { width: '100%', height: '100%' },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, paddingHorizontal: 10, marginRight: 15 },
  searchInputIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, color: themeColors.textLight, fontSize: 16 },
  clearSearchButton: { padding: 5 },
  cancelSearchText: { color: themeColors.textLight, fontSize: 16, fontWeight: '500' },
  searchResultsContainer: { flex: 1 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.grey, paddingHorizontal: 15 },
  searchAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: themeColors.grey },
  searchAvatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  searchUsername: { color: themeColors.textLight, fontSize: 16, fontWeight: '500' },
  searchDisplayName: { color: themeColors.textSecondary, fontSize: 14 },
});