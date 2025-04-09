import React, {useState, useEffect, useCallback} from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import {useRouter, useLocalSearchParams} from "expo-router";
import {doc, setDoc, updateDoc} from "firebase/firestore";
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL
  } from "firebase/storage";
import {auth, db, storage, functions} from "../firebaseConfig";
import {httpsCallable} from "firebase/functions";
import * as ImagePicker from "expo-image-picker";
import {LinearGradient} from "expo-linear-gradient";
import {themeColors} from "../styles/theme";
import {Ionicons} from "@expo/vector-icons";
import debounce from 'lodash.debounce';

// Interface for user profile data
interface UserProfile {
  username?: string;
  displayName?: string;
  photoURL?: string | null;
}

// Type for username availability status
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export default function ProfileEditScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const params = useLocalSearchParams<{
    mode?: "setup" | "edit";
    currentUsername?: string;
    currentDisplayName?: string;
    currentPhotoURL?: string;
  }>();
  console.log("Edit Screen Params:", params); // Log params on load

  const mode = params.mode || "edit";
  const isSetupMode = mode === "setup";

  // Form State
  const [displayName, setDisplayName] = useState(params.currentDisplayName || "");
  const [username, setUsername] = useState(params.currentUsername || "");
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null); // Local URI for preview
  const [photoUrlToSave, setPhotoUrlToSave] = useState<string | null>(params.currentPhotoURL || null);

  // UI State
  const [loading, setLoading] = useState(false); // For main save button
  const [imageUploading, setImageUploading] = useState(false); // For immediate image upload
  const [error, setError] = useState<string | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [originalUsername, setOriginalUsername] = useState(params.currentUsername || "");

  // --- Username Availability Check ---
  const checkUsernameAvailability = useCallback(
    async (uname: string) => {
        if (!uname || uname.length < 3) { setUsernameStatus("invalid"); return; }
        if (uname === originalUsername) { setUsernameStatus("idle"); return; }
        setUsernameStatus("checking");
        try {
            const checkUsernameFunction = httpsCallable<{username: string}, {exists: boolean}>( functions, 'checkUsernameAvailability' );
            const result = await checkUsernameFunction({ username: uname });
            setUsernameStatus(result.data.exists ? "taken" : "available");
        } catch (err) {
            console.error("Username check error:", err);
            setUsernameStatus("error");
        }
    }, [originalUsername]
  );
  const debouncedCheckUsername = useCallback(debounce(checkUsernameAvailability, 500), [checkUsernameAvailability]);
  useEffect(() => {
     debouncedCheckUsername(username.trim().toLowerCase());
     return () => { debouncedCheckUsername.cancel(); };
  }, [username, debouncedCheckUsername]);


  // --- Immediate Image Upload Function ---
  const uploadProfilePicture = async (uri: string) => {
    if (!user) { setError("Cannot upload image - user not logged in."); return; }
    setImageUploading(true);
    setError(null);
    console.log("Starting immediate profile picture upload for URI:", uri);

    try {
      const response = await fetch(uri);
      console.log("Fetched image URI, status:", response.status);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

      const blob = await response.blob();
      console.log("Created blob, size:", blob.size, "type:", blob.type);
      if (blob.size === 0) throw new Error("Cannot upload empty image file.");

      let fileExtension = "jpg";
      const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (blob.type && allowedMimeTypes.includes(blob.type)) {
        switch (blob.type) {
            case "image/jpeg": fileExtension = "jpg"; break;
            case "image/png": fileExtension = "png"; break;
            case "image/webp": fileExtension = "webp"; break;
            case "image/gif": fileExtension = "gif"; break;
        }
        console.log(`Derived extension '${fileExtension}' from blob type '${blob.type}'`);
      } else {
          throw new Error(`Invalid image file type. Allowed: JPEG, PNG, GIF, WebP.`);
      }

      const storagePath = `profile-pictures/${user.uid}/profile.${fileExtension}`;
      const storageRef = ref(storage, storagePath);
      const metadata = { contentType: blob.type };

      console.log("Starting upload to path:", storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      await uploadTask; // Wait for completion or error
      console.log("Immediate upload task finished successfully.");

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      console.log("Profile picture immediately uploaded, URL:", downloadURL);

      setPhotoUrlToSave(downloadURL); // Update the URL state to be saved
      // --- <<< FIX 1 Applied: Clear local preview URI >>> ---
      setProfileImageUri(null);

    } catch (err: any) {
        console.error("Error during immediate image upload:", err);
        setError(`Image upload failed: ${err.message || 'Unknown error'}`);
        setProfileImageUri(null); // Also clear local URI on error
        setPhotoUrlToSave(params.currentPhotoURL || null); // Revert to original URL on fail
    } finally {
        setImageUploading(false); // Stop image loading indicator
    }
  };


  // --- Image Picker Logic ---
  const pickImage = async (useCamera: boolean = false) => {
    setError(null);
    setProfileImageUri(null); // Clear previous local preview first
    try {
      let result: ImagePicker.ImagePickerResult;
       if (useCamera) {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
            result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        } else {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert("Permission Required", "Photo library access needed."); return; }
            result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
        }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        setProfileImageUri(newUri); // Set local preview immediately
        await uploadProfilePicture(newUri); // Trigger immediate upload
      }
    } catch (e: any) {
      console.error("Image picker error:", e);
      setError("Failed to select image.");
      setImageUploading(false); // Ensure indicator stops if picker fails
    }
  };

  // --- Save Profile Logic ---
  const handleSave = async () => {
    if (!user) { setError("You must be logged in."); return; }
    const finalUsername = username.trim().toLowerCase();
    const finalDisplayName = displayName.trim();

    // Basic Validation
    if (!finalDisplayName) { setError("Please enter a display name."); return; }
    if (!finalUsername || finalUsername.length < 3) { setError("Username must be at least 3 characters long."); return; }
    if (!/^[a-z0-9_]+$/.test(finalUsername)) { setError("Username can only contain lowercase letters, numbers, and underscores."); return; }

    // Re-check username availability if changed
    let usernameAvailableOrUnchanged = true;
    if (finalUsername !== originalUsername) {
        setUsernameStatus("checking");
        try {
            const checkFunction = httpsCallable<{username: string}, {exists: boolean}>(functions, 'checkUsernameAvailability');
            const result = await checkFunction({ username: finalUsername });
            if (result.data.exists) {
                setUsernameStatus("taken"); setError("Username is not available."); usernameAvailableOrUnchanged = false;
            } else { setUsernameStatus("available"); }
        } catch (err) {
             console.error("Username check error during save:", err); setUsernameStatus("error");
             setError("Could not verify username."); usernameAvailableOrUnchanged = false;
        }
        if (!usernameAvailableOrUnchanged) { setLoading(false); return; }
    }

    setLoading(true);
    setError(null);

    try {
      // Image upload is already handled

      // Prepare data for Firestore using photoUrlToSave
      const profileData: Partial<UserProfile> = {
        username: finalUsername,
        displayName: finalDisplayName,
        photoURL: photoUrlToSave,
      };

      console.log("Saving profile data to Firestore:", profileData);
      const userDocRef = doc(db, "users", user.uid);

      // Save to Firestore (set or update)
      if (isSetupMode) {
         await setDoc(userDocRef, profileData, { merge: true });
      } else {
         await updateDoc(userDocRef, profileData);
      }

      console.log("Profile saved successfully!");
      Alert.alert("Profile Saved", "Your profile has been updated.");

      // Redirect to profile tab
      router.replace('/(tabs)/profile');

    } catch (err: any) {
      console.error("Error during Firestore save:", err);
      setError(`Failed to save profile data: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // --- Render Helper for Username Status ---
  const renderUsernameStatus = () => {
      switch(usernameStatus) {
          case 'checking': return <Text style={styles.statusTextChecking}>Checking...</Text>;
          case 'available': return username !== originalUsername ? <Text style={styles.statusTextAvailable}>Available!</Text> : null;
          case 'taken': return <Text style={styles.statusTextTaken}>Username taken</Text>;
          case 'invalid': return <Text style={styles.statusTextInvalid}>Invalid (min 3 chars, a-z, 0-9, _)</Text>;
          case 'error': return <Text style={styles.statusTextError}>Error checking</Text>;
          case 'idle': default: return null;
      }
  };

  // --- Render ---
  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper} >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled" >
        <Text style={styles.title}> {isSetupMode ? "Setup Profile" : "Edit Profile"} </Text>

        {/* Profile Picture Section */}
        <View style={styles.profilePicContainer}>
          <TouchableOpacity activeOpacity={1}>
             {/* --- Display Logic Revised Further --- */}
             {imageUploading ? ( // 1. Show loader if uploading
                 <View style={styles.imageLoadingOverlay}><ActivityIndicator size="small" color={themeColors.textLight} /></View>
              ) : profileImageUri ? ( // 2. Show local preview if just picked
                  <Image source={{uri: profileImageUri}} style={styles.profilePic} />
              ) : photoUrlToSave ? ( // 3. Show the saved/uploaded URL if no local preview
                  // <<< FIX 2 Applied: Added key prop >>>
                  <Image key={photoUrlToSave} source={{uri: photoUrlToSave}} style={styles.profilePic} />
              ) : ( // 4. Fallback placeholder
                  <View style={[styles.profilePic, styles.profilePicPlaceholder]}>
                      <Ionicons name="person-circle-outline" size={80} color={themeColors.grey}/>
                  </View>
              )}
             {/* Camera Icon overlay (show only if NOT uploading) */}
             {!imageUploading && ( <View style={styles.editIconContainer}><Ionicons name="camera" size={20} color={themeColors.textLight} /></View> )}
          </TouchableOpacity>
        </View>
        <View style={styles.imageButtonsRow}>
             <TouchableOpacity style={[styles.imageButton, imageUploading && styles.buttonDisabled]} onPress={() => pickImage(false)} disabled={imageUploading}>
                <Ionicons name="images" size={20} color={themeColors.pink} style={{marginRight: 5}}/>
                <Text style={styles.imageButtonText}>Gallery</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.imageButton, imageUploading && styles.buttonDisabled]} onPress={() => pickImage(true)} disabled={imageUploading}>
                <Ionicons name="camera" size={20} color={themeColors.blue} style={{marginRight: 5}}/>
                <Text style={styles.imageButtonText}>Camera</Text>
             </TouchableOpacity>
         </View>

        {/* Form Fields */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your Full Name" placeholderTextColor={themeColors.textSecondary} autoCapitalize="words" maxLength={50}/>
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput style={[ styles.input, usernameStatus === 'taken' || usernameStatus === 'invalid' ? styles.inputError : {} ]} value={username} onChangeText={setUsername} placeholder="unique_username" placeholderTextColor={themeColors.textSecondary} autoCapitalize="none" autoCorrect={false} maxLength={30} />
          <View style={styles.statusContainer}>{renderUsernameStatus()}</View>
        </View>

         {error && ( <Text style={styles.formErrorText}>{error}</Text> )}

        {/* Save Button */}
        <TouchableOpacity style={[styles.saveButton, loading || imageUploading ? styles.buttonDisabled : {}]} onPress={handleSave} disabled={loading || imageUploading || usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'} >
          {loading ? ( <ActivityIndicator color={themeColors.textLight} /> ) : ( <Text style={styles.saveButtonText}>Save Profile</Text> )}
        </TouchableOpacity>

        {/* Cancel Button */}
        {!loading && !imageUploading && (
             <TouchableOpacity style={styles.cancelButton} onPress={() => router.replace('/(tabs)/profile')}>
                 <Text style={styles.cancelButtonText}>Cancel</Text>
             </TouchableOpacity>
         )}

      </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  gradientWrapper: { flex: 1, },
  scrollContainer: { flexGrow: 1, alignItems: "center", paddingBottom: 50, paddingTop: 20, },
  title: { fontSize: 26, fontWeight: "bold", color: themeColors.textLight, marginBottom: 20, marginTop: Platform.OS === 'ios' ? 20 : 10, },
  profilePicContainer: { width: 130, height: 130, borderRadius: 65, overflow: "hidden", marginBottom: 10, borderWidth: 3, borderColor: themeColors.pink, backgroundColor: themeColors.darkGrey, position: 'relative', justifyContent: 'center', alignItems: 'center', },
  profilePic: { width: "100%", height: "100%", },
  profilePicPlaceholder: { justifyContent: 'center', alignItems: 'center', },
  editIconContainer: { position: 'absolute', bottom: 5, right: 5, backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 6, borderRadius: 15, },
  imageLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 65, },
  imageButtonsRow: { flexDirection: 'row', justifyContent: 'center', width: '80%', marginBottom: 30, },
  imageButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, marginHorizontal: 10, borderRadius: 20, borderWidth: 1, borderColor: themeColors.grey, },
  imageButtonText: { color: themeColors.textSecondary, fontSize: 14, },
  inputContainer: { width: "90%", marginBottom: 15, },
  label: { fontSize: 14, color: themeColors.textSecondary, marginBottom: 6, marginLeft: 4, },
  input: { backgroundColor: themeColors.darkGrey, color: themeColors.textLight, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10, fontSize: 16, borderWidth: 1, borderColor: themeColors.grey, },
  inputError: { borderColor: themeColors.errorRed, },
  statusContainer: { height: 20, marginTop: 4, },
  statusTextBase: { fontSize: 12, marginLeft: 4, },
  statusTextChecking: { color: themeColors.textSecondary, fontStyle: 'italic', },
  statusTextAvailable: { color: themeColors.successGreen, },
  statusTextTaken: { color: themeColors.errorRed, },
  statusTextInvalid: { color: themeColors.errorRed, },
  statusTextError: { color: themeColors.errorRed, fontStyle: 'italic', },
  formErrorText: { color: themeColors.errorRed, fontSize: 14, textAlign: 'center', marginTop: 10, marginBottom: 10, width: '90%', },
  saveButton: { backgroundColor: themeColors.pink, paddingVertical: 15, borderRadius: 25, alignItems: "center", width: "90%", marginTop: 20, minHeight: 50, justifyContent: 'center', },
  saveButtonText: { color: themeColors.textLight, fontSize: 16, fontWeight: "bold", },
  buttonDisabled: { opacity: 0.5, },
  cancelButton: { marginTop: 15, paddingVertical: 10, },
  cancelButtonText: { color: themeColors.textSecondary, fontSize: 14, textAlign: 'center', },
});