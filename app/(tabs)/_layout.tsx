// File: app/(tabs)/_layout.tsx (Removing image and caption screen definitions)

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Pressable, View, StyleSheet } from 'react-native'; // Keep Pressable, View, StyleSheet
import { themeColors } from '../../styles/theme';

// Keep CustomFlexTabButton if you want to ensure flex distribution
// or remove it if the default distribution works once image/caption are gone.
// For now, let's keep it to be sure about the 4 visible items.
const CustomFlexTabButton = (props: any) => {
  const { accessibilityState, children, onPress, onLongPress, style } = props;
  const focused = accessibilityState.selected;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.customTabButtonContainer,
        { opacity: pressed ? 0.7 : 1 },
        style
      ]}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
    >
      {children}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  customTabButtonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: themeColors.darkGrey },
        headerTintColor: themeColors.textLight,
        headerTitleStyle: { color: themeColors.textLight },
        tabBarStyle: {
          backgroundColor: themeColors.pink,
          borderTopWidth: 0,
           shadowOffset: { width: 0, height: -1 },
           shadowOpacity: 0.1,
           shadowRadius: 3,
           elevation: 5,
           flexDirection: 'row',
        },
        tabBarActiveTintColor: themeColors.textLight,
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
        tabBarLabelStyle: { fontSize: 11, paddingBottom: 3 },
        tabBarIconStyle: { marginTop: 3 },
      }}>

      {/* === Your 4 Visible Tab Screens === */}
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "camera" : "camera-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (<Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />),
          tabBarButton: (props) => <CustomFlexTabButton {...props} />,
        }}
      />
      {/* === END Visible Tab Screens === */}


      {/* === REMOVED image AND caption Tabs.Screen DEFINITIONS === */}
      {/* <Tabs.Screen name="image" options={{ tabBarButton: () => null }} /> */}
      {/* <Tabs.Screen name="caption" options={{ tabBarButton: () => null }} /> */}
      {/* === END REMOVAL === */}


      {/* --- Hidden Screen for User Profile View (Still relevant if pushed within tabs) --- */}
      <Tabs.Screen
        name="userProfile" // Assumes app/(tabs)/userProfile.tsx still exists for this purpose
        options={
          ({ navigation }) => ({
            headerShown: true,
            title: 'User Profile',
            headerStyle: { backgroundColor: themeColors.darkGrey },
            headerTintColor: themeColors.textLight,
            headerTitleStyle: { color: themeColors.textLight },
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: 15 }} >
                <Ionicons name="chevron-back" size={28} color={themeColors.textLight} />
              </TouchableOpacity>
            ),
            tabBarButton: () => null, // Ensure this remains completely hidden from the bar
          })
        }
      />
      {/* === END Hidden User Profile Screen === */}

    </Tabs>
  );
}