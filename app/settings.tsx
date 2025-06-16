import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router'; // Stack is no longer needed here
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { LinearGradient } from 'expo-linear-gradient';
import { themeColors } from '../styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}

export default function SettingsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      Alert.alert('Logout Error', error.message || 'Failed to sign out.');
    }
  };

  const navigateToEdit = () => {
    router.push({
      pathname: "/profile-edit",
      params: {
        mode: 'edit',
        currentUsername: profile?.username || '',
        currentDisplayName: profile?.displayName || '',
        currentPhotoURL: profile?.photoURL || ''
      }
    });
  };

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView>
          <View style={styles.infoGroup}>
            <Text style={styles.groupTitle}>Account Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Display Name</Text>
              <Text style={styles.infoValue}>{profile?.displayName || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>@{profile?.username || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.actionsGroup}>
            <TouchableOpacity style={styles.actionButton} onPress={navigateToEdit}>
              <Ionicons name="pencil-outline" size={22} color={themeColors.textLight} />
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={themeColors.textLight} />
              <Text style={styles.actionButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientWrapper: { flex: 1 },
  safeArea: { flex: 1 },
  infoGroup: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 15,
  },
  groupTitle: {
    color: themeColors.textLight,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    borderBottomColor: themeColors.grey,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    color: themeColors.textSecondary,
    fontSize: 16,
  },
  infoValue: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: '500',
  },
  actionsGroup: {
    marginHorizontal: 20,
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: themeColors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  actionButtonText: {
    color: themeColors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  logoutButton: {
    backgroundColor: themeColors.pink,
  },
});