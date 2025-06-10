// app/post/[id].tsx (Detailed Post View Screen)

import React, { useEffect, useState, useLayoutEffect } from 'react'; // Added useLayoutEffect
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Platform, StatusBar, Alert
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';     // Adjust path if firebaseConfig is in root
import PostCard, { Post as PostData } from '../../components/PostCard'; // Adjust path to your PostCard component
import { themeColors } from '../../styles/theme';   // Adjust path
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Keep for PostCard or header icons

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = params.id;
  const router = useRouter();
  const navigation = useNavigation(); // For setting header options dynamically

  const [post, setPost] = useState<PostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  // useLayoutEffect to set initial header options that might depend on sync values
  // or before the first paint if possible, though title will update in useEffect
  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Loading Post...', // Initial title
      headerShown: true,
      headerStyle: { backgroundColor: themeColors.darkGrey },
      headerTintColor: themeColors.textLight, // Color of back arrow and default title
      headerTitleStyle: { color: themeColors.textLight, fontSize: 18 },
      // headerBackTitle: "Back", // For iOS, to set text next to back arrow
    });
  }, [navigation]);

  useEffect(() => {
    if (!postId) {
      setError("Post ID is missing. Cannot load post.");
      setIsLoading(false);
      navigation.setOptions({ title: 'Error' });
      return;
    }

    setIsLoading(true);
    setError(null);
    const postDocRef = doc(db, "posts", postId);

    const unsubscribe = onSnapshot(postDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedPost = { id: docSnap.id, ...docSnap.data() } as PostData;
        setPost(fetchedPost);
        // Dynamically set header title based on fetched post
        navigation.setOptions({ title: fetchedPost.username ? `${fetchedPost.username}'s Post` : 'Post Details' });
        setError(null); // Clear previous error if post is found
      } else {
        setError("Post not found.");
        setPost(null);
        navigation.setOptions({ title: 'Post Not Found' });
      }
      setIsLoading(false);
    }, (err) => {
      console.error(`Error fetching post detail for ID ${postId}:`, err);
      setError("Failed to load post details. Please try again.");
      setIsLoading(false);
      navigation.setOptions({ title: 'Error Loading' });
    });

    return () => unsubscribe(); // Cleanup listener on unmount
  }, [postId, navigation]); // Re-run effect if postId or navigation changes


  // --- Placeholder Handlers for PostCard Actions ---
  const handleLike = (pId: string, isLiked: boolean) => {
    console.log(`PostCard Like from Detail: Post ID ${pId}, Is Liked: ${isLiked}`);
    Alert.alert("Like Action", `Post ${pId} like status: ${isLiked}`);
    // TODO: Implement Firestore update for likes for this specific post
    // This might involve updating the 'post' state if likesCount changes
  };

  const handleComment = (pId: string) => {
    console.log(`PostCard Comment from Detail: Post ID ${pId}`);
    Alert.alert("Comment Action", `Open comments for post ${pId}`);
    // TODO: Implement navigation to comment screen or open comment modal
  };

  const handleShare = (pId: string) => {
    console.log(`PostCard Share from Detail: Post ID ${pId}`);
    Alert.alert("Share Action", `Share post ${pId}`);
    // TODO: Implement sharing functionality
  };

  const handleToggleMute = (pId: string, songUrl: string | null) => {
    console.log(`PostCard Toggle Mute from Detail: Post ID ${pId}, URL: ${songUrl}`);
    Alert.alert("Mute/Unmute Action", `Toggle audio for post ${pId}`);
    // TODO: Implement audio playback state for this screen
  };

  const handleDeletePostFromDetail = (pId: string) => {
    if (currentUser?.uid !== post?.userId) { // Check if the current user is the owner
        Alert.alert("Permission Denied", "You can only delete your own posts.");
        return;
    }
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", pId));
              Alert.alert("Post Deleted", "This post has been removed.");
              router.back(); // Navigate back after successful deletion
            } catch (e: any) {
              Alert.alert("Error", "Could not delete post.");
              console.error("Error deleting post from detail:", e);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleHidePostFromDetail = (pId: string) => {
    Alert.alert("Hide Post", `Hide post ${pId} (Functionality to be implemented).`);
  };


  if (isLoading) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        {/* Stack.Screen for header while loading */}
        <Stack.Screen options={{ title: "Loading Post...", headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <ActivityIndicator size="large" color={themeColors.pink} />
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: "Error", headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/community')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  if (!post) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: "Not Found", headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.infoText}>Post not available or does not exist.</Text>
         <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/community')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      {/* Header is configured by navigation.setOptions in useEffect or the initial Stack.Screen options */}
      {/* We can also define it here again if we prefer it to override any defaults */}
      <Stack.Screen
        options={{
          // title is dynamically set in useEffect based on post.username
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.darkGrey },
          headerTintColor: themeColors.textLight,
          headerTitleStyle: { color: themeColors.textLight, fontSize: 18 },
          // headerBackTitle: "Community", // iOS specific
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <PostCard
          post={post} // post is guaranteed to be non-null here
          currentUserId={currentUser?.uid}
          showMenu={post.userId === currentUser?.uid} // Show menu if it's the user's own post
          onDeletePost={handleDeletePostFromDetail}
          onHidePost={handleHidePostFromDetail}
          onPressLike={handleLike}
          onPressComment={handleComment}
          onPressShare={handleShare}
          onToggleMute={handleToggleMute}
          // You'll need to manage isCurrentlyPlayingAudio and isMuted state here
          // if you want audio to play on this detail screen.
          // isCurrentlyPlayingAudio={/* pass audio state for this post */}
          // isMuted={/* pass mute state */}
        />
        {/* Future: Comments section will go here */}
        <View style={{height: 40}} /> {/* Extra space at the bottom */}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: {
    flex: 1,
    // paddingTop is handled by SafeAreaView equivalent of Stack navigator or StatusBar component for native
  },
  scrollContainer: {
    paddingBottom: 20,
    // alignItems: 'center', // PostCard should take full width by default
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, // For full screen message
  },
  errorText: {
    color: themeColors.errorRed,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  infoText: {
    color: themeColors.textSecondary,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 25, // Made it wider
    backgroundColor: themeColors.pink,
    borderRadius: 8,
  },
  backButtonText: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  }
});