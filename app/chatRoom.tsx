// app/chatRoom.tsx (Full Code with All Current Fixes)

import React, { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Alert,
  Platform, StatusBar, Text, TouchableOpacity
} from 'react-native';
import {
  GiftedChat, IMessage, User as GiftedUser, Bubble, Time // Ensure Time and Bubble are imported
} from 'react-native-gifted-chat';
import { useLocalSearchParams, Stack, useRouter, useNavigation } from 'expo-router';
import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp,
  doc, updateDoc, getDoc, Timestamp // Timestamp for type if needed
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig'; // Adjust path if firebaseConfig is not in root
import { User as FirebaseAuthUser } from 'firebase/auth';
import { themeColors } from '../styles/theme'; // Adjust path
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons'; // Keep for potential future use in header

// Helper to format Firestore Timestamps for GiftedChat
const formatMessageTimestamp = (timestamp: any): Date => {
  if (timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  // console.warn("Formatting non-timestamp value (or serverTimestamp pending):", timestamp);
  return new Date(); // Fallback
};

export default function ChatRoomScreen() {
  const params = useLocalSearchParams<{ chatId?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const chatId = params.chatId;

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseAuthUser | null>(auth.currentUser);
  const [otherUserName, setOtherUserName] = useState<string | null>(null);
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

  // Fetch other user's name for header and load messages
  useLayoutEffect(() => {
    if (!chatId) {
        setError("Chat ID missing."); setIsLoading(false); navigation.setOptions({ title: "Error" }); return;
    }
    if (!currentUser) { // currentUser might be null on initial render before onAuthStateChanged fires
        console.log("ChatRoomScreen: Current user not available yet for fetching chat details. Waiting for auth state.");
        setIsLoading(true); // Keep loading indicator if user isn't ready
        return;
    }

    setIsLoading(true); setError(null);
    const chatDocRef = doc(db, 'chats', chatId);

    // Fetch chat details (other user's name)
    getDoc(chatDocRef).then(chatSnap => {
      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        const otherUserId = chatData.users?.find((uid: string) => uid !== currentUser.uid);
        let nameToSet = 'Chat'; // Default title

        if (otherUserId && chatData.userNames && chatData.userNames[otherUserId]) {
          nameToSet = chatData.userNames[otherUserId];
        } else if (otherUserId) {
          // Fallback: fetch user doc if name not denormalized
          getDoc(doc(db, 'users', otherUserId)).then(userSnap => {
            if(userSnap.exists()){
              const fetchedName = userSnap.data()?.username || userSnap.data()?.displayName || 'Chat User';
              setOtherUserName(fetchedName); // Update state for potential re-renders
              navigation.setOptions({ title: fetchedName }); // Set title again if fetched async
            }
          }).catch(userDocError => console.error("Error fetching other user's details for header:", userDocError));
        }
        setOtherUserName(nameToSet); // Set state for potential re-renders
        navigation.setOptions({ title: nameToSet });
      } else {
        setError("Chat not found.");
        navigation.setOptions({ title: "Chat Not Found" });
      }
      // Message loading will set isLoading to false later if chat details were found
      // If chat not found, message loading won't start, so set loading false here too.
      if (!chatSnap.exists()) setIsLoading(false);
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
      const loadedMessages = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const giftedUser: GiftedUser = {
          _id: data.senderId,
          // name: data.senderName, // Optional: If you store sender name on messages
          // avatar: data.senderAvatar, // Optional
        };
        return {
          _id: doc.id,
          text: data.text,
          createdAt: formatMessageTimestamp(data.createdAt),
          user: giftedUser,
        };
      });
      setMessages(loadedMessages);
      setIsLoading(false); // Messages loaded (or list is empty)
    }, (messageError) => {
      console.error("Error fetching messages: ", messageError);
      setError("Could not load messages.");
      setIsLoading(false);
    });

    return () => {
        unsubscribeMessages();
    };
  }, [chatId, currentUser, navigation]); // navigation is in dep array due to setOptions

  // Send messages
  const onSend = useCallback((newMessages: IMessage[] = []) => {
    if (!chatId || !currentUser) {
      Alert.alert("Error", "Cannot send message. User not authenticated or chat not available.");
      return;
    }

    const messageToSend = newMessages[0];
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatDocRef = doc(db, 'chats', chatId);

    addDoc(messagesRef, {
      text: messageToSend.text,
      createdAt: serverTimestamp(),
      senderId: currentUser.uid,
    }).then(() => {
      updateDoc(chatDocRef, {
        lastMessage: { text: messageToSend.text, createdAt: serverTimestamp(), senderId: currentUser.uid, },
        updatedAt: serverTimestamp(),
      }).catch(err => console.error("Error updating last message:", err));
    }).catch(err => {
      console.error("Error sending message:", err);
      Alert.alert("Error", "Message could not be sent.");
    });
  }, [chatId, currentUser]);


  // --- Conditional Rendering for Loading/Error States ---
  if (isLoading && messages.length === 0) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: 'Loading Chat...', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <ActivityIndicator size="large" color={themeColors.pink} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </LinearGradient>
    );
  }

  if (error) {
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
        <Stack.Screen options={{ title: 'Error', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chat')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  // This check is vital before rendering GiftedChat which requires currentUser.uid
  if (!currentUser || !chatId) {
    // This case should ideally be hit only if something went wrong with navigation or auth state recovery
    console.warn("ChatRoomScreen: Rendering missing user/chatId state, this might indicate an issue.");
    return (
      <LinearGradient colors={themeColors.backgroundGradient} style={styles.centeredFeedback}>
         <Stack.Screen options={{ title: 'Error', headerShown: true, headerStyle: { backgroundColor: themeColors.darkGrey }, headerTintColor: themeColors.textLight }} />
        <Text style={styles.infoText}>Chat cannot be loaded. User or Chat ID missing.</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/chat')} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    );
  }
  // --- End Conditional Rendering ---

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <Stack.Screen
        options={{
          title: otherUserName || 'Chat',
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.darkGrey },
          headerTintColor: themeColors.textLight,
          headerTitleStyle: { color: themeColors.textLight, fontSize: 18 },
        }}
      />
      <GiftedChat
        messages={messages}
        onSend={msgs => onSend(msgs)}
        user={{
          _id: currentUser.uid, // currentUser is guaranteed non-null here
        }}
        textInputProps={{ // Moved textInputStyle and placeholderTextColor here
          style: styles.textInputStyle,
          placeholderTextColor: themeColors.textSecondary,
        }}
        renderBubble={props => { // For bubble styling
          return (
            <Bubble
              {...props}
              wrapperStyle={{
                right: { backgroundColor: themeColors.pink },
                left: { backgroundColor: themeColors.darkGrey, borderWidth:1, borderColor: themeColors.grey },
              }}
              textStyle={{ // Styles the main message text
                right: { color: themeColors.textLight },
                left: { color: themeColors.textLight },
              }}
              // timeTextStyle is removed from Bubble as it's not a direct prop
            />
          );
        }}
        renderTime={(timeProps) => ( // Use renderTime to style the Time component
          <Time
            {...timeProps}
            timeTextStyle={{
              left: { color: themeColors.textSecondary, marginHorizontal: 10, marginBottom: 5, fontSize: 10 },
              right: { color: themeColors.textLight, marginHorizontal: 10, marginBottom: 5, fontSize: 10 },
            }}
          />
        )}
        messagesContainerStyle={styles.messagesContainer}
        bottomOffset={Platform.OS === "ios" ? 30 : 0}
        placeholder="Type your message..." // Default placeholder text
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: {
    flex: 1,
  },
  centeredFeedback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: themeColors.textSecondary,
    marginTop: 10,
    fontSize: 16,
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
    paddingHorizontal: 25,
    backgroundColor: themeColors.pink,
    borderRadius: 8,
  },
  backButtonText: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  textInputStyle: {
    color: themeColors.textLight,
    backgroundColor: themeColors.darkGrey,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    marginHorizontal: 8,
    marginBottom: Platform.OS === 'ios' ? 5 : Platform.OS === 'android' ? 2 : 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.grey,
    fontSize: 16,
  },
  messagesContainer: {
    backgroundColor: 'transparent',
  }
});