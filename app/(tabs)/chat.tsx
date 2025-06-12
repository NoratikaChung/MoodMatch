// app/(tabs)/chat.tsx (Chat List Screen)

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Platform, StatusBar, Alert
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig'; // Adjust path
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme'; // Adjust path
import { Ionicons } from '@expo/vector-icons';
import { User as FirebaseAuthUser } from 'firebase/auth';

// Default avatar if user has no profile image or it fails to load
const DEFAULT_AVATAR = require('../../assets/images/icon.png'); // ADJUST PATH

// Interface for a chat session displayed in the list
interface ChatSession {
  id: string; // Firestore document ID of the chat
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessageText: string | null;
  lastMessageTimestamp: Date | null; // Converted from Firestore Timestamp
  // unreadCount?: number; // For later
}

export default function ChatListScreen() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const router = useRouter();

  // Listen to auth state
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (!user) {
        setChatSessions([]); // Clear chats if user logs out
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch chat sessions
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false); // Not loading if no user
      setChatSessions([]); // Ensure chat list is empty if no user
      return;
    }

    setIsLoading(true);
    setError(null);

    const chatsQuery = query(
      collection(db, "chats"),
      where("users", "array-contains", currentUser.uid), // Chats current user is part of
      orderBy("updatedAt", "desc") // Most recent chats first
    );

    const unsubscribe = onSnapshot(chatsQuery, (querySnapshot) => {
      const sessions: ChatSession[] = [];
      querySnapshot.forEach((doc) => {
        const chatData = doc.data();
        const otherUserId = chatData.users.find((uid: string) => uid !== currentUser.uid);

        if (otherUserId) {
          sessions.push({
            id: doc.id,
            otherUserId: otherUserId,
            otherUserName: chatData.userNames?.[otherUserId] || 'Chat User', // Use denormalized name
            otherUserAvatar: chatData.userPhotos?.[otherUserId] || null,   // Use denormalized photo
            lastMessageText: chatData.lastMessage?.text || "No messages yet...",
            lastMessageTimestamp: chatData.lastMessage?.createdAt?.toDate ? chatData.lastMessage.createdAt.toDate() : null,
          });
        }
      });
      setChatSessions(sessions);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching chat sessions:", err);
      setError("Failed to load your chats.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]); // Rerun when currentUser changes

  const navigateToChatRoom = (chatId: string, otherUserName: string, otherUserAvatar: string | null) => {
    router.push({
      pathname: '/chatRoom', // Navigate to app/chatRoom.tsx
      params: {
        chatId: chatId,
        // Optional: pass other user's info to avoid re-fetching in chatRoom header initially
        // otherUserName: otherUserName,
        // otherUserAvatar: otherUserAvatar
      }
    });
  };

  // Function to format timestamp for display (e.g., "3 mins ago", "Yesterday")
  const formatChatTimestamp = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(); // Fallback to full date
  };


  if (isLoading) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <ActivityIndicator size="large" color={themeColors.pink} />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Text style={styles.errorText}>{error}</Text>
        {/* Optional: Add a retry button */}
      </LinearGradient>
    );
  }

  if (!currentUser) {
      return (
        <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
            <Text style={styles.infoText}>Please log in to see your chats.</Text>
            <Link href="/login" asChild>
                <TouchableOpacity style={styles.loginButton}>
                    <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>
            </Link>
        </LinearGradient>
      );
  }

  if (chatSessions.length === 0) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Text style={styles.title}>Chat List</Text>
        <Ionicons name="chatbubbles-outline" size={60} color={themeColors.textSecondary} style={{ marginVertical: 20 }}/>
        <Text style={styles.infoText}>No conversations yet.</Text>
        <Text style={styles.infoTextSub}>Start a chat from a user's profile!</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        {/* You might want a header here similar to your reference image */}
        <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>MoodMatch Chats</Text>
            {/* Add hamburger menu icon or other icons if needed */}
            {/* <TouchableOpacity><Ionicons name="menu" size={28} color={themeColors.textLight} /></TouchableOpacity> */}
        </View>

        <FlatList
          data={chatSessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItemContainer}
              onPress={() => navigateToChatRoom(item.id, item.otherUserName, item.otherUserAvatar)}
            >
              <Image
                source={item.otherUserAvatar ? { uri: item.otherUserAvatar } : DEFAULT_AVATAR}
                style={styles.avatar}
              />
              <View style={styles.chatTextContainer}>
                <Text style={styles.userName}>{item.otherUserName}</Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessageText}
                </Text>
              </View>
              <View style={styles.chatMetaContainer}>
                <Text style={styles.timestamp}>{formatChatTimestamp(item.lastMessageTimestamp)}</Text>
                {/* Optional: Unread count badge */}
                {/* {item.unreadCount && item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )} */}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  headerContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between', // Or 'center' if only title
    alignItems: 'center',
    // borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor: themeColors.grey,
  },
  headerTitle: {
    color: themeColors.textLight,
    fontSize: 22,
    fontWeight: 'bold',
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: { color: themeColors.textSecondary, marginTop: 10, fontSize: 16 },
  errorText: { color: themeColors.errorRed, fontSize: 16, textAlign: 'center' },
  infoText: { color: themeColors.textSecondary, fontSize: 17, textAlign: 'center', marginBottom: 5, },
  infoTextSub: { color: themeColors.grey, fontSize: 15, textAlign: 'center', },
  loginButton: { backgroundColor: themeColors.pink, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginTop: 20, },
  loginButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },
  title: { // For the "No conversations yet" screen
    fontSize: 22,
    fontWeight: 'bold',
    color: themeColors.textLight,
    marginBottom: 10,
  },
  // Chat Item Styles
  chatItemContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: themeColors.darkGrey, // Or a slightly lighter shade
    marginHorizontal: 10,
    borderRadius: 10,
    marginVertical: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: themeColors.grey, // Placeholder color
  },
  chatTextContainer: {
    flex: 1, // Takes up available space
    justifyContent: 'center',
  },
  userName: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  lastMessage: {
    color: themeColors.textSecondary,
    fontSize: 14,
  },
  chatMetaContainer: {
    alignItems: 'flex-end', // Aligns timestamp and badge to the right
    marginLeft: 10,
  },
  timestamp: {
    color: themeColors.grey,
    fontSize: 12,
    marginBottom: 5,
  },
  unreadBadge: {
    backgroundColor: themeColors.pink,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: themeColors.textLight,
    fontSize: 10,
    fontWeight: 'bold',
  },
  separator: {
    // height: StyleSheet.hairlineWidth,
    // backgroundColor: themeColors.grey,
    // marginHorizontal: 15, // If you want a line separator
    height: 0, // No separator line, using margin on items for space
  },
});