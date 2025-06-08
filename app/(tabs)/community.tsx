// app/(tabs)/community.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  // Button, // Using TouchableOpacity for better styling consistency
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView, // Import SafeAreaView
} from 'react-native';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useRouter } from 'expo-router'; // Use for navigation
// --- Fix: Import 'db' instead of 'FIREBASE_DB' ---
import { db, auth } from '../../firebaseConfig'; // Make sure auth is also exported if needed for excluding self later
// --- End Fix ---
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient
import { themeColors } from '../../styles/theme';     // Import themeColors
import { Ionicons } from '@expo/vector-icons';       // Import Ionicons (optional, but good practice)


interface User {
  id: string; // Document ID (uid)
  username: string;
  displayName?: string; // Optional: Add fields you might fetch/display
  photoURL?: string;    // Optional
}

export default function CommunityScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const router = useRouter();
  const currentUser = auth.currentUser; // Get current user if needed later

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery === '') {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    setSearched(true);
    setSearchResults([]);

    try {
      // --- Fix: Use 'db' variable ---
      const usersRef = collection(db, 'users');
      // --- End Fix ---

      // Ensure username search query is lowercase if usernames are stored lowercase
      const lowerCaseQuery = trimmedQuery.toLowerCase();

      const q = query(
        usersRef,
        where('username', '>=', lowerCaseQuery), // Assuming usernames are stored lowercase for case-insensitive prefix search
        where('username', '<=', lowerCaseQuery + '\uf8ff'),
        limit(10)
      );

      const querySnapshot = await getDocs(q);
      const users: User[] = [];
      querySnapshot.forEach((doc) => {
        // Optional: Exclude self from search results
        // if (doc.id !== currentUser?.uid) {
        // Ensure data matches User interface
        const data = doc.data();
        users.push({
          id: doc.id,
          username: data.username || 'N/A', // Provide default if needed
          displayName: data.displayName,
          photoURL: data.photoURL,
        });
        // }
      });
      setSearchResults(users);
    } catch (error) {
      console.error("Error searching users: ", error);
      // Consider displaying user-friendly error message
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToProfile = (userId: string) => {
    // Navigate to the profile screen, passing the userId
    // Use the correct path for your profile screen within the tabs structure
    router.push({ pathname: '/userProfile', params: { userId: userId } });
  };

  return (
    <LinearGradient
      colors={themeColors.backgroundGradient}
      style={styles.gradientWrapper}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Creative Community</Text>

          {/* Search Input */}
          <TextInput
            style={styles.input}
            placeholder="Search by username..."
            placeholderTextColor={themeColors.textSecondary} // Style placeholder
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch} // Search when enter is pressed
            autoCapitalize="none"
            returnKeyType="search" // Set keyboard return key type
          />

          {/* Search Button (using TouchableOpacity for styling) */}
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]} // Add disabled style
            onPress={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={themeColors.textLight} />
            ) : (
              <Text style={styles.buttonText}>Search</Text>
            )}
          </TouchableOpacity>

          {/* Loading Indicator */}
          {/* Moved loading indicator inside the button or handle separately */}

          {/* Results Area */}
          <View style={styles.resultsContainer}>
            {!isLoading && searched && searchResults.length === 0 && (
              <Text style={styles.infoText}>No users found.</Text>
            )}

            {!isLoading && searchResults.length > 0 && (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => navigateToProfile(item.id)} style={styles.resultItem}>
                    {/* Optional: Add user image */}
                    {/* <Image source={item.photoURL ? { uri: item.photoURL } : require('@/assets/images/default-avatar.png')} style={styles.resultAvatar} /> */}
                    <View style={styles.resultTextContainer}>
                       <Text style={styles.resultUsername}>{item.username}</Text>
                       {item.displayName && <Text style={styles.resultDisplayName}>{item.displayName}</Text>}
                    </View>
                  </TouchableOpacity>
                )}
                style={{ width: '100%' }} // Ensure FlatList takes width
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// --- Styles (Adapted from ProfileScreen and added specifics) ---
const styles = StyleSheet.create({
  gradientWrapper: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center', // Center items horizontally
    paddingTop: 40, // Adjust top padding as needed
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 25,
    color: themeColors.textLight,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: themeColors.darkGrey, // Dark input background
    color: themeColors.textLight,         // Light text color
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themeColors.grey,       // Subtle border
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    width: '100%',
    paddingVertical: 15,
    backgroundColor: themeColors.pink, // Use theme color
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25, // Space below button
    minHeight: 50, // Ensure consistent height even with indicator
  },
  buttonDisabled: {
    backgroundColor: themeColors.grey, // Style for disabled button
  },
  buttonText: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1, // Allow FlatList to take remaining space
    width: '100%',
  },
  infoText: { // Style for 'No users found'
    fontSize: 16,
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginTop: 30,
  },
  resultItem: {
    flexDirection: 'row', // Layout avatar and text
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.grey, // Use theme color for separator
    width: '100%',
  },
  // resultAvatar: { // Optional avatar styles
  //   width: 40,
  //   height: 40,
  //   borderRadius: 20,
  //   marginRight: 15,
  //   backgroundColor: themeColors.darkGrey, // Placeholder bg
  // },
   resultTextContainer: {
      flex: 1, // Take remaining space
   },
  resultUsername: {
    fontSize: 16,
    fontWeight: '500',
    color: themeColors.textLight, // Light text for username
  },
   resultDisplayName: {
     fontSize: 14,
     color: themeColors.textSecondary, // Secondary color for display name
   },
});