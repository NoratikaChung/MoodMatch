import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Platform, StatusBar,
  SafeAreaView
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { User as FirebaseAuthUser } from 'firebase/auth';

// <<< IMPORT YOUR REUSABLE HEADER COMPONENT >>>
import AppHeader from '../../components/AppHeader';

// Default avatar if user has no profile image or it fails to load
const DEFAULT_AVATAR = require('../../assets/images/icon.png');

interface ChatSession {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessageText: string | null;
  lastMessageTimestamp: Date | null;
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
        setChatSessions([]); setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Fetch chat sessions
  useEffect(() => {
    if (!currentUser) {
      setIsLoading(false); setChatSessions([]); return;
    }
    setIsLoading(true); setError(null);
    const chatsQuery = query(
      collection(db, "chats"),
      where("users", "array-contains", currentUser.uid),
      orderBy("updatedAt", "desc")
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
            otherUserName: chatData.userNames?.[otherUserId] || 'Chat User',
            otherUserAvatar: chatData.userPhotos?.[otherUserId] || null,
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
  }, [currentUser]);

  const navigateToChatRoom = (chatId: string) => {
    router.push({ pathname: '/chatRoom', params: { chatId: chatId } });
  };

  const formatChatTimestamp = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return `${diffSeconds}s`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  // Loading, error, and not-logged-in states do not need the header
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
      </LinearGradient>
    );
  }
  if (!currentUser) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Text style={styles.infoText}>Please log in to see your chats.</Text>
        <Link href="/login" asChild>
          <TouchableOpacity style={styles.loginButton}><Text style={styles.loginButtonText}>Login</Text></TouchableOpacity>
        </Link>
      </LinearGradient>
    );
  }

  // "No Chats" screen now includes the header for consistency
  if (chatSessions.length === 0) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centeredFeedback}>
            <Ionicons name="chatbubbles-outline" size={60} color={themeColors.textSecondary} style={{ marginVertical: 20 }}/>
            <Text style={styles.infoText}>No conversations yet.</Text>
            <Text style={styles.infoTextSub}>Start a chat from a user's profile!</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Main chat list screen with the header
  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        {/* The new header is placed here, outside the FlatList */}
        <AppHeader>
          <Text style={styles.headerTitle}>Chats</Text>
        </AppHeader>

        <FlatList
          data={chatSessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 10 }} // Add some padding
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItemContainer}
              onPress={() => navigateToChatRoom(item.id)}
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
              <Text style={styles.timestamp}>{formatChatTimestamp(item.lastMessageTimestamp)}</Text>
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
  // <<< MODIFIED: Removed top padding as AppHeader now handles it >>>
  safeArea: { flex: 1 },
  // <<< REMOVED: headerContainer and headerTitle are no longer needed >>>
  centeredFeedback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { color: themeColors.textSecondary, marginTop: 10, fontSize: 16 },
  errorText: { color: themeColors.errorRed, fontSize: 16, textAlign: 'center' },
  infoText: { color: themeColors.textSecondary, fontSize: 17, textAlign: 'center', marginBottom: 5 },
  infoTextSub: { color: themeColors.grey, fontSize: 15, textAlign: 'center' },
  loginButton: { backgroundColor: themeColors.pink, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25, marginTop: 20 },
  loginButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold' },
  chatItemContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)', // Subtle background
    marginHorizontal: 10,
    borderRadius: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: themeColors.grey },
  chatTextContainer: { flex: 1, justifyContent: 'center' },
  userName: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', marginBottom: 3 },
  lastMessage: { color: themeColors.textSecondary, fontSize: 14 },
  timestamp: { color: themeColors.grey, fontSize: 12, marginLeft: 10 },
  separator: { height: 8 }, headerTitle: { color: themeColors.textLight, fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
});