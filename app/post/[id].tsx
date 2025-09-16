import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, SafeAreaView, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc, onSnapshot, deleteDoc, updateDoc, increment,
  arrayUnion, arrayRemove, collection, addDoc, serverTimestamp, query, orderBy, getDoc
} from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import PostCard, { Post as PostData } from '../../components/PostCard';
import { themeColors } from '../../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '../../components/AppHeader';

interface Comment { id: string; text: string; userId: string; username: string; userProfileImageUrl: string | null; createdAt: any; }

export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const postId = params.id;
  const router = useRouter();

  const [post, setPost] = useState<PostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUser = auth.currentUser;
  const [headerTitle, setHeaderTitle] = useState('Loading Post...');
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isCommentInputVisible, setIsCommentInputVisible] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!postId) {
      setError("Post ID is missing."); setIsLoading(false); setHeaderTitle('Error'); return;
    }
    const postDocRef = doc(db, "posts", postId);
    const unsubscribe = onSnapshot(postDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const fetchedPost = { id: docSnap.id, ...docSnap.data() } as PostData;
        setPost(fetchedPost);
        setHeaderTitle(fetchedPost.username ? `${fetchedPost.username}'s Post` : 'Post Details');
      } else {
        setError("Post not found."); setPost(null); setHeaderTitle('Post Not Found');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedComments: Comment[] = [];
      querySnapshot.forEach((doc) => { fetchedComments.push({ id: doc.id, ...doc.data() } as Comment); });
      setComments(fetchedComments);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleLikePost = async (postToUpdate: PostData) => {
    if (!currentUser) { Alert.alert("Login Required"); return; }
    const postRef = doc(db, 'posts', postToUpdate.id);
    const isAlreadyLiked = postToUpdate.likedBy?.includes(currentUser.uid);
    try {
      await updateDoc(postRef, {
        likedBy: isAlreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        likesCount: increment(isAlreadyLiked ? -1 : 1)
      });
    } catch (e: any) { Alert.alert("Error", `Could not update like status: ${e.message}`); }
  };

  const handleAddComment = async () => {
    if (!currentUser || !postId) { Alert.alert("Error", "Cannot post comment."); return; }
    const trimmedComment = newComment.trim();
    if (trimmedComment === '') return;
    setIsPostingComment(true);
    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const userData = userDoc.data();
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        text: trimmedComment, userId: currentUser.uid, username: userData?.username || 'Anonymous',
        userProfileImageUrl: userData?.photoURL || null, createdAt: serverTimestamp(),
      });
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, { commentsCount: increment(1) });
      setNewComment('');
    } catch (e: any) { Alert.alert("Error", "Could not post your comment.");
    } finally { setIsPostingComment(false); }
  };

  const handleCommentPress = () => { setIsCommentInputVisible(true); setTimeout(() => textInputRef.current?.focus(), 100); };
  const handleShare = (pId: string) => Alert.alert("Share Action", `Share post ${pId}`);
  const handleDeletePostFromDetail = (pId: string) => {
    if (currentUser?.uid !== post?.userId) { Alert.alert("Permission Denied"); return; }
    Alert.alert( "Delete Post", "Are you sure?",
      [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: async () => {
            try { await deleteDoc(doc(db, "posts", pId)); router.back(); } catch (e: any) { Alert.alert("Error", "Could not delete post."); }
          },
        },
      ]
    );
  };
  const handleUsernamePress = (userIdOfPostAuthor: string) => {
    if (!userIdOfPostAuthor) return;
    if (userIdOfPostAuthor === currentUser?.uid) { router.push('/(tabs)/profile'); }
    else { router.push({ pathname: '/userProfile', params: { userId: userIdOfPostAuthor } }); }
  };

  const renderCommentItem = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <TouchableOpacity onPress={() => handleUsernamePress(item.userId)}>
        <Image source={item.userProfileImageUrl ? { uri: item.userProfileImageUrl } : require('../../assets/images/icon.png')} style={styles.commentAvatar}/>
      </TouchableOpacity>
      <View style={styles.commentTextContainer}>
        <Text style={styles.commentTextWrapper}>
          <Text style={styles.commentUsername} onPress={() => handleUsernamePress(item.userId)}>{item.username} </Text>
          <Text style={styles.commentText}>{item.text}</Text>
        </Text>
      </View>
    </View>
  );

  if (isLoading) { return <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}><ActivityIndicator size="large" color={themeColors.pink} /></LinearGradient>; }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        <AppHeader>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}><Ionicons name="arrow-back" size={24} color={themeColors.textLight} /></TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>
            <View style={styles.headerIcon} />
          </View>
        </AppHeader>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}>
          {error || !post ? (
            <View style={styles.centeredFeedback}>
              <Text style={styles.errorText}>{error || "Post not available."}</Text>
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.backButtonText}>Go Back</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              <FlatList
                // THE FIX: Restored the correct structure. PostCard is the header, comments are the data.
                ListHeaderComponent={
                  <PostCard
                    post={post}
                    currentUserId={currentUser?.uid}
                    showMenu={post.userId === currentUser?.uid}
                    onDeletePost={handleDeletePostFromDetail}
                    onPressLike={handleLikePost}
                    onPressUsername={handleUsernamePress}
                    onPressShare={handleShare}
                    onPressComment={handleCommentPress}
                  />
                }
                data={comments}
                renderItem={renderCommentItem}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={styles.centeredFeedbackSmall}>
                    <Text style={styles.infoText}>Be the first to comment.</Text>
                  </View>
                }
                contentContainerStyle={styles.scrollContainer}
              />

              {isCommentInputVisible && (
                <View style={styles.commentInputContainer}>
                  <TextInput
                    ref={textInputRef}
                    style={styles.input}
                    placeholder="Add a comment..."
                    placeholderTextColor={themeColors.textSecondary}
                    value={newComment}
                    onChangeText={setNewComment}
                    onBlur={() => setIsCommentInputVisible(false)}
                  />
                  <TouchableOpacity onPress={handleAddComment} disabled={isPostingComment || newComment.trim() === ''}>
                    <Text style={[styles.postButtonText, (isPostingComment || newComment.trim() === '') && styles.postButtonDisabled]}>Post</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContainer: { paddingBottom: 10 },
  centeredFeedback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  centeredFeedbackSmall: { padding: 20, alignItems: 'center' },
  errorText: { color: themeColors.errorRed, fontSize: 18, textAlign: 'center', marginBottom: 20 },
  infoText: { color: themeColors.textSecondary, fontSize: 15 },
  backButton: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 25, backgroundColor: themeColors.pink, borderRadius: 8 },
  backButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  headerTitle: { color: themeColors.textLight, fontSize: 18, fontWeight: 'bold', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  headerIcon: { padding: 5, width: 40, alignItems: 'center' },
  commentInputContainer: { flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: 1, borderTopColor: themeColors.grey, backgroundColor: themeColors.backgroundGradient[1] },
  input: { flex: 1, height: 40, backgroundColor: themeColors.darkGrey, borderRadius: 20, paddingHorizontal: 15, color: themeColors.textLight, marginRight: 10 },
  postButtonText: { color: themeColors.pink, fontWeight: 'bold', fontSize: 16 },
  postButtonDisabled: { color: themeColors.textSecondary },
  commentContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, marginTop: 2 },
  commentTextContainer: { flex: 1, justifyContent: 'center' },
  commentTextWrapper: { flexDirection: 'row', flexWrap: 'wrap' },
  commentUsername: { fontWeight: 'bold', color: themeColors.textLight, fontSize: 14 },
  commentText: { color: themeColors.textLight, fontSize: 14, lineHeight: 19 },
});