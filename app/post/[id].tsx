import React, { useEffect, useState, useLayoutEffect } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Platform, StatusBar, Alert, SafeAreaView
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
// <<< STEP 1: Import necessary Firestore and Auth functions >>>
import {
  doc, onSnapshot, deleteDoc, updateDoc, increment,
  arrayUnion, arrayRemove
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import PostCard, { Post as PostData } from '../../components/PostCard';
import { themeColors } from '../../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// <<< IMPORT YOUR REUSABLE HEADER COMPONENT >>>
import AppHeader from '../../components/AppHeader';

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = params.id;
  const router = useRouter();
  const navigation = useNavigation();

  const [post, setPost] = useState<PostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  // This state will hold the dynamic title for the header
  const [headerTitle, setHeaderTitle] = useState('Loading Post...');

  // This useEffect now only sets the dynamic title for the header
  useEffect(() => {
    if (!postId) {
      setError("Post ID is missing. Cannot load post.");
      setIsLoading(false);
      setHeaderTitle('Error'); // Use state for title
      return;
    }

    setIsLoading(true);
    setError(null);
    const postDocRef = doc(db, "posts", postId);

    const unsubscribe = onSnapshot(postDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedPost = { id: docSnap.id, ...docSnap.data() } as PostData;
        setPost(fetchedPost);
        setHeaderTitle(fetchedPost.username ? `${fetchedPost.username}'s Post` : 'Post Details');
        setError(null);
      } else {
        setError("Post not found.");
        setPost(null);
        setHeaderTitle('Post Not Found');
      }
      setIsLoading(false);
    }, (err) => {
      console.error(`Error fetching post detail for ID ${postId}:`, err);
      setError("Failed to load post details. Please try again.");
      setIsLoading(false);
      setHeaderTitle('Error Loading');
    });

    return () => unsubscribe();
  }, [postId]);


  // <<< STEP 2: Implement the real Like functionality >>>
  const handleLikePost = async (postToUpdate: PostData) => {
    if (!currentUser) {
      Alert.alert("Please log in", "You must be logged in to like posts.");
      return;
    }
    const postRef = doc(db, 'posts', postToUpdate.id);
    const isAlreadyLiked = postToUpdate.likedBy?.includes(currentUser.uid);
    try {
      if (isAlreadyLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUser.uid),
          likesCount: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUser.uid),
          likesCount: increment(1)
        });
      }
    } catch (e: any) {
      console.error("Error updating like status:", e);
      Alert.alert("Error", `Could not update like status: ${e.message}`);
    }
  };

  // The rest of your original handler functions are preserved
  const handleComment = (pId: string) => {
    console.log(`PostCard Comment from Detail: Post ID ${pId}`);
    Alert.alert("Comment Action", `Open comments for post ${pId}`);
  };

  const handleShare = (pId: string) => {
    console.log(`PostCard Share from Detail: Post ID ${pId}`);
    Alert.alert("Share Action", `Share post ${pId}`);
  };

  const handleToggleMute = (pId: string, songUrl: string | null) => {
    console.log(`PostCard Toggle Mute from Detail: Post ID ${pId}, URL: ${songUrl}`);
    Alert.alert("Mute/Unmute Action", `Toggle audio for post ${pId}`);
  };

  const handleDeletePostFromDetail = (pId: string) => {
    if (currentUser?.uid !== post?.userId) {
        Alert.alert("Permission Denied", "You can only delete your own posts.");
        return;
    }
    Alert.alert(
      "Delete Post", "Are you sure you want to delete this post?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "posts", pId));
              Alert.alert("Post Deleted", "This post has been removed.");
              router.back();
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

  const handleUsernamePress = (userIdOfPostAuthor: string) => {
    if (!userIdOfPostAuthor) return;
    if (userIdOfPostAuthor === currentUser?.uid) {
      router.push('/(tabs)/profile');
    } else {
      router.push({
        pathname: '/userProfile',
        params: { userId: userIdOfPostAuthor },
      });
    }
  };

  // Your original loading state rendering is preserved
  if (isLoading) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <ActivityIndicator size="large" color={themeColors.pink} />
      </LinearGradient>
    );
  }

  // <<< THE UI IS UPDATED HERE >>>
  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        {/* We now use the AppHeader component instead of Stack.Screen */}
        <AppHeader>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
              <Ionicons name="arrow-back" size={24} color={themeColors.textLight} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <View style={styles.headerIcon} />{/* Spacer to keep title centered */}
          </View>
        </AppHeader>

        {error || !post ? (
          // This view handles both error and post-not-found states
          <View style={styles.centeredFeedback}>
            <Text style={styles.errorText}>{error || "Post not available."}</Text>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // This view renders the actual post
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <PostCard
              post={post}
              currentUserId={currentUser?.uid}
              showMenu={post.userId === currentUser?.uid}
              onDeletePost={handleDeletePostFromDetail}
              onHidePost={handleHidePostFromDetail}
              onPressLike={handleLikePost} // <<< Use the real like function
              onPressUsername={handleUsernamePress}
              onPressComment={handleComment}
              onPressShare={handleShare}
              onToggleMute={handleToggleMute}
            />
            <View style={{height: 40}} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 }, // Added for new structure
  scrollContainer: { paddingBottom: 20 },
  centeredFeedback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: themeColors.errorRed, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  infoText: { color: themeColors.textSecondary, fontSize: 18, textAlign: 'center', marginBottom: 20 }, // Preserved from your original code
  backButton: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 25, backgroundColor: themeColors.pink, borderRadius: 8 },
  backButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  // --- NEW STYLES for the custom header ---
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  headerTitle: { color: themeColors.textLight, fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  headerIcon: { padding: 5, width: 40 },
});