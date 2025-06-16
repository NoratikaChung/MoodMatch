// app/chatRoom.tsx (Based on YOUR last provided code, with UI Enhancements)

import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Alert,
  Platform, StatusBar, Text, TouchableOpacity, Image, // Added Image
  KeyboardAvoidingView // Added for iOS input handling
} from 'react-native';
import {
  GiftedChat, IMessage, User as GiftedUser, Bubble, Time,
  Send, InputToolbar, Composer,
  SendProps, InputToolbarProps, ComposerProps // <<< ADD SendProps, InputToolbarProps, ComposerProps HERE
} from 'react-native-gifted-chat';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, getDoc, Timestamp
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';     // Path relative to app/
import { User as FirebaseAuthUser } from 'firebase/auth';
import { themeColors } from '../styles/theme';   // Path relative to app/
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// Assuming default-avatar.png is in YourProject/assets/images/
const DEFAULT_AVATAR_CHAT = require('../assets/images/icon.png'); // ADJUST if path is different from app/

// Helper to format Firestore Timestamps for GiftedChat
const formatMessageTimestamp = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date(); // Fallback
};

interface OtherUserInfo {
  name: string | null;
  avatarUrl: string | null;
}

export default function ChatRoomScreen() {
  const params = useLocalSearchParams<{ chatId?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const chatId = params.chatId;

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [otherUserInfo, setOtherUserInfo] = useState<OtherUserInfo>({ name: null, avatarUrl: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effect to listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
        setCurrentUser(user);
        if (!user) {
            console.log("ChatRoomScreen: User logged out, redirecting.");
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/login');
            }
        }
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch other user's name & avatar for header and load messages
  useLayoutEffect(() => {
    if (!chatId) {
        setError("Chat ID missing."); setIsLoading(false);
        navigation.setOptions({ title: "Error" }); return;
    }
    if (!currentUser) {
        setIsLoading(true); return;
    }

    setIsLoading(true); setError(null);
    const chatDocRef = doc(db, 'chats', chatId);

    // Fetch chat details for header
    getDoc(chatDocRef).then(chatSnap => {
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUserId = chatData.users?.find((uid: string) => uid !== currentUser.uid);
        let nameToSet = 'Chat';
        let avatarToSet: string | null = null;

        if (otherUserId) {
            nameToSet = chatData.userNames?.[otherUserId] || 'Chat User';
            avatarToSet = chatData.userPhotos?.[otherUserId] || null;

            // Fallback if denormalized data is missing (optional)
            if (!chatData.userNames?.[otherUserId] || !chatData.userPhotos?.[otherUserId]) {
                getDoc(doc(db, 'users', otherUserId)).then(userSnap => {
                    if(userSnap.exists()){
                        const userData = userSnap.data();
                        nameToSet = userData?.username || userData?.displayName || nameToSet;
                        avatarToSet = userData?.photoURL || avatarToSet;
                        setOtherUserInfo({ name: nameToSet, avatarUrl: avatarToSet });
                        navigation.setOptions({ headerTitle: () => renderHeaderTitle(nameToSet, avatarToSet) });
                    }
                }).catch(e => console.error("Error fetching other user details for header fallback: ", e));
            }
        }
        setOtherUserInfo({ name: nameToSet, avatarUrl: avatarToSet });
        navigation.setOptions({ headerTitle: () => renderHeaderTitle(nameToSet, avatarToSet) });
      } else {
        setError("Chat not found.");
        navigation.setOptions({ title: "Chat Not Found" });
        setIsLoading(false); // Stop loading if chat not found
      }
    }).catch(err => {
        console.error("Error fetching chat details for header:", err);
        setError("Could not load chat details.");
        setIsLoading(false);
        navigation.setOptions({ title: "Error Loading Chat" });
    });

    // Load messages
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));
    const unsubscribeMessages = onSnapshot(q, (querySnapshot) => {
      const loadedMessages = querySnapshot.docs.map(docSnapInternal => {
        const data = docSnapInternal.data();
        const giftedUser: GiftedUser = { _id: data.senderId };
        return { _id: docSnapInternal.id, text: data.text, createdAt: formatMessageTimestamp(data.createdAt), user: giftedUser };
      });
      setMessages(loadedMessages);
      setIsLoading(false);
    }, (messageError) => {
      console.error("Error fetching messages: ", messageError);
      setError("Could not load messages.");
      setIsLoading(false);
    });

    // Mark messages as read when chat room is opened or messages update
    const markAsRead = async () => {
        if (currentUser?.uid) {
            try {
                await updateDoc(chatDocRef, { [`readBy.${currentUser.uid}`]: serverTimestamp() });
            } catch (e) { console.error("Error marking chat as read:", e); }
        }
    };
    markAsRead(); // Mark as read on initial load/focus

    return () => {
        unsubscribeMessages();
    };
  }, [chatId, currentUser, navigation]);


  const onSend = useCallback((newMessages: IMessage[] = []) => {
    if (!chatId || !currentUser) { Alert.alert("Error", "Cannot send message."); return; }
    const messageToSend = newMessages[0];
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatDocRef = doc(db, 'chats', chatId);
    addDoc(messagesRef, {
      text: messageToSend.text, createdAt: serverTimestamp(), senderId: currentUser.uid,
    }).then(() => {
      updateDoc(chatDocRef, {
        lastMessage: { text: messageToSend.text, createdAt: serverTimestamp(), senderId: currentUser.uid, },
        updatedAt: serverTimestamp(),
        // Also update readBy for the sender
        [`readBy.${currentUser.uid}`]: serverTimestamp(),
      }).catch(err => console.error("Error updating last message/readBy:", err));
    }).catch(err => { console.error("Error sending message:", err); Alert.alert("Error", "Message could not be sent."); });
  }, [chatId, currentUser]);

  // --- Custom Header Title Component ---
  const renderHeaderTitle = (name: string | null, avatarUrl: string | null) => (
    <View style={styles.headerTitleContainer}>
      <Image
        source={avatarUrl ? { uri: avatarUrl } : DEFAULT_AVATAR_CHAT}
        style={styles.headerAvatar}
      />
      <Text style={styles.headerTitleText} numberOfLines={1}>{name || 'Chat'}</Text>
    </View>
  );

  // --- Custom GiftedChat Components for UI ---
  const renderSend = (props: SendProps<IMessage>) => (
    <Send {...props} containerStyle={styles.sendButtonContainer} alwaysShowSend>
      {/* Using a larger, more visible send icon container */}
      <View style={styles.sendIconWrapper}>
        <Ionicons name="send" size={24} color={themeColors.pink} />
      </View>
    </Send>
  );

  const renderInputToolbar = (props: InputToolbarProps<IMessage>) => (
    <InputToolbar {...props} containerStyle={styles.inputToolbar} primaryStyle={styles.inputToolbarPrimary}/>
  );

  const renderComposer = (props: ComposerProps) => (
    <Composer {...props} textInputStyle={styles.composerTextInput} placeholder="Type your message..." placeholderTextColor={themeColors.textSecondary} />
  );


  if (isLoading && messages.length === 0) {
    return ( // <<< REPLACE COMMENT WITH ACTUAL JSX
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: 'Loading Chat...', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <ActivityIndicator size="large" color={themeColors.pink} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </LinearGradient>
    );
  }
  if (error) {
    return ( // <<< REPLACE COMMENT WITH ACTUAL JSX
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: 'Error', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chat')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }
  if (!currentUser || !chatId) {
    // This case should ideally be hit only if something went wrong with navigation or auth state recovery
    console.warn("ChatRoomScreen: Rendering missing user/chatId state, this might indicate an issue.");
    return ( // <<< REPLACE COMMENT WITH ACTUAL JSX (if you had a specific UI here)
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
         <Stack.Screen options={{ title: 'Error', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.infoText}>Chat cannot be loaded. User or Chat ID missing.</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chat')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.darkGrey },
          headerTintColor: themeColors.textLight, // Back arrow color
          headerTitle: () => renderHeaderTitle(otherUserInfo.name, otherUserInfo.avatarUrl),
        }}
      />
      <GiftedChat
        messages={messages}
        onSend={msgs => onSend(msgs)}
        user={{ _id: currentUser.uid }} // currentUser is non-null here
        alignTop
        alwaysShowSend
        renderInputToolbar={renderInputToolbar}
        renderComposer={renderComposer}
        renderSend={renderSend}
        minInputToolbarHeight={Platform.OS === 'ios' ? 44 : 50}
        messagesContainerStyle={styles.messagesContainer}
        renderBubble={props => {
          return (
            <Bubble
              {...props}
              wrapperStyle={{
                right: { backgroundColor: themeColors.pink, marginLeft: 50, marginRight: 5, marginVertical: 4, borderRadius: 15, paddingVertical: 3, paddingHorizontal: 5 },
                left: { backgroundColor: themeColors.blue, marginRight: 50, marginLeft: 5, marginVertical: 4, borderRadius: 15, paddingVertical: 3, paddingHorizontal: 5 },
              }}
              textStyle={{
                right: { color: themeColors.textLight, fontSize: 15, lineHeight: 20 },
                left: { color: themeColors.textLight, fontSize: 15, lineHeight: 20 },
              }}
              // timeTextStyle removed from Bubble props
            />
          );
        }}
        renderTime={(timeProps) => ( // Time styling handled by renderTime
          <Time
            {...timeProps}
            timeTextStyle={{
              left: { color: themeColors.textSecondary, marginHorizontal: 10, marginBottom: 5, fontSize: 10 },
              right: { color: themeColors.textLight, marginHorizontal: 10, marginBottom: 5, fontSize: 10 },
            }}
          />
        )}
        placeholder="Type your message..."
        bottomOffset={Platform.OS === "ios" ? 25 : 0} // Adjusted bottomOffset
        keyboardShouldPersistTaps='never'
      />
      { Platform.OS === 'ios' && <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={90} /> }
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1, },
  centeredFeedback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, },
  loadingText: { color: themeColors.textSecondary, marginTop: 10, fontSize: 16, },
  errorText: { color: themeColors.errorRed, fontSize: 18, textAlign: 'center', marginBottom: 20, },
  infoText: { color: themeColors.textSecondary, fontSize: 18, textAlign: 'center', marginBottom: 20, },
  backButton: { marginTop: 20, paddingVertical: 10, paddingHorizontal: 25, backgroundColor: themeColors.pink, borderRadius: 8, },
  backButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', },

  // --- Header Styles ---
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: Platform.OS === 'ios' ? -10 : -20, }, // Adjusted marginLeft
  headerAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10, backgroundColor: themeColors.grey, },
  headerTitleText: { color: themeColors.textLight, fontSize: 17, fontWeight: '600', },

  // --- GiftedChat UI Styles ---
  messagesContainer: { backgroundColor: 'transparent', paddingBottom: 5, },
  inputToolbar: {
    backgroundColor: themeColors.darkGrey, // This will be the "white box" but dark
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.grey,
    paddingHorizontal: 6, // Reduced overall padding
    paddingVertical: Platform.OS === 'ios' ? 8 : 2, // Adjusted padding
    minHeight: 50,
  },
  inputToolbarPrimary: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align items to bottom (good for multiline input)
  },
  composerTextInput: { // The actual TextInput field
    color: themeColors.textLight,
    backgroundColor: themeColors.darkGrey, // Match toolbar or make slightly different
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8, // Consistent padding
    fontSize: 16,
    lineHeight: 20,
    flex: 1, // Make composer take available width
    marginRight: 8, // Space before send button
  },
  sendButtonContainer: { // Container for the Send button itself
    height: 44, // Standard touchable height
    justifyContent: 'center',
    alignItems: 'center',
    // No explicit width, let icon define it with padding
  },
  sendIconWrapper: { // Wrapper around the icon for better touch area and centering
    paddingHorizontal: 10, // Makes send button wider and easier to tap
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});