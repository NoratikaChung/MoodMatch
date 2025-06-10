// TEMPORARY app/chatRoom.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Stack } from 'expo-router';

export default function MinimalChatRoomScreen() {
  console.log("--- MINIMAL ChatRoomScreen RENDERING ---");
  return (
    <>
      <Stack.Screen options={{ title: "Minimal Chat", headerShown: true }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'lightcoral' }}>
        <Text style={{ fontSize: 20 }}>MINIMAL CHAT ROOM</Text>
      </View>
    </>
  );
}