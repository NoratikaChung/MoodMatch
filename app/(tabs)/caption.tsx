import React, { useState, useEffect } from "react";
import {
  StyleSheet, Text, View, ActivityIndicator, Image, Alert,
  TouchableOpacity, Platform, Dimensions, ScrollView, TextInput
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, storage, functions } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { themeColors } from "../../styles/theme";
import { Ionicons } from "@expo/vector-icons";

// --- Interfaces ---
// Re-use from image.tsx if needed, or define specific ones
interface GenerateCaptionData { imageUrl: string; }
interface GenerateCaptionResult { caption: string | null; }

// --- Component ---
export default function TabCaptionScreen() {
  // --- State Variables ---
  const [functionResponse, setFunctionResponse] = useState(""); // Status message
  const [isLoading, setIsLoading] = useState(false);         // Main loading indicator
  const [isUploading, setIsUploading] = useState(false);      // Upload specific indicator
  const [isGenerating, setIsGenerating] = useState(false);    // Caption generation indicator
  const [error, setError] = useState("");                   // Error messages
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
  const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null); // Store URL after upload
  const [generatedCaption, setGeneratedCaption] = useState<string | null>(null);

  // --- Helper Functions ---
  const resetState = (keepImage: boolean = false) => {
    setFunctionResponse("");
    setError("");
    setIsLoading(false);
    setIsUploading(false);
    setIsGenerating(false);
    setUploadProgress(0);
    setGeneratedCaption(null);
    if (!keepImage) {
      setSelectedImageUri(null);
      setSelectedImageWidth(null);
      setSelectedImageHeight(null);
      setUploadedImageUrl(null);
    }
  };

  // --- Image Picker Logic (Similar to image.tsx) ---
  const pickImage = async (useCamera: boolean = false) => {
    console.log("--- pickImage (Caption) ---");
    resetState(); // Reset fully when picking new image
    try {
       let result: ImagePicker.ImagePickerResult;
       if (useCamera) {
           const perm = await ImagePicker.requestCameraPermissionsAsync();
           if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
           result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.9 });
       } else {
           const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) { Alert.alert("Permission Required", "Photo library access needed."); return; }
           result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.9 });
       }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.width && asset.height) {
          setSelectedImageUri(asset.uri);
          setSelectedImageWidth(asset.width);
          setSelectedImageHeight(asset.height);
        } else {
          setSelectedImageUri(asset.uri); // Still set URI if dims missing
        }
      } else { console.log("Image selection cancelled."); }
    } catch (e: any) {
      console.error("pickImage error:", e); Alert.alert("Error", e.message);
    }
  };

  // --- Call Generate Caption Function ---
  const callGenerateCaptionFunction = async (imageUrl: string | null) => {
    if (!imageUrl) {
        setError("Cannot generate caption: Image URL missing.");
        setIsLoading(false); // Ensure main loader stops
        return;
    }
    console.log("Attempting call 'generateCaption'...", imageUrl);
    setIsGenerating(true); // Use specific loader
    setError("");
    setGeneratedCaption(null); // Clear previous caption
    setFunctionResponse("✨ Generating caption...");

    try {
      const generateCaptionFunction = httpsCallable<GenerateCaptionData, GenerateCaptionResult>(
        functions, 'generateCaption'
      );
      const result = await generateCaptionFunction({ imageUrl: imageUrl });

      console.log("Cloud Function Response (Caption):", result.data);
      if (result.data?.caption) {
          setGeneratedCaption(result.data.caption);
          setFunctionResponse("Caption generated!");
      } else {
          setGeneratedCaption("Could not generate a caption for this image.");
          setFunctionResponse(""); // Clear status
      }
    } catch (error: any) {
      console.error("Error calling 'generateCaption':", error);
      let errorMessage = `Caption generation failed: ${error.message}`;
      if (error.code) { errorMessage += ` (Code: ${error.code})`; }
      if (error.details) { console.error("Function error details:", error.details); }
      setError(errorMessage);
      setGeneratedCaption(null);
      setFunctionResponse('');
    } finally {
      setIsGenerating(false);
      setIsLoading(false); // Also stop main loader if it was on
    }
  };

  // --- Upload Image & Trigger Caption Flow ---
  const handleUploadAndGenerate = async () => {
    if (!selectedImageUri) { Alert.alert("No Image", "Please select or take an image first."); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert("Not Authenticated", "Please log in."); return; }

    console.log("--- handleUploadAndGenerate ---");
    resetState(true); // Keep image but clear errors/status
    setIsLoading(true); // Use main loader for upload part
    setIsUploading(true);
    setFunctionResponse('Starting upload...');
    setUploadProgress(0);

    try {
      const response = await fetch(selectedImageUri);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Blob size is 0.");

      let fileExtension = "jpg";
      if (blob.type && blob.type.startsWith("image/")) {
         fileExtension = blob.type.split("/")[1] === 'jpeg' ? 'jpg' : blob.type.split("/")[1];
      }

      const uniqueFilename = `${uuidv4()}.${fileExtension}`;
      // Store captions images separately or reuse 'images'? Let's use 'images' for now.
      const storagePath = `images/${currentUser.uid}/${uniqueFilename}`;
      if (!storage) throw new Error("Storage not initialized.");
      const storageRef = ref(storage, storagePath);
      console.log("Uploading caption image to:", storagePath);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed',
        (s) => {
          const p = (s.bytesTransferred / s.totalBytes) * 100;
          setUploadProgress(p);
          setFunctionResponse(`Uploading: ${Math.round(p)}%`);
        },
        (e) => { // Error
          console.error("Upload Error:", e);
          let msg = `Upload failed: ${e.message}`;
          if ((e as any).code === 'storage/unauthorized') { msg = `Upload fail: Permission denied.`; }
          setError(msg);
          setFunctionResponse(''); setIsLoading(false); setIsUploading(false); setUploadProgress(0);
        },
        () => { // Completion -> Call Caption Generation
          console.log('Upload successful:', storagePath);
          getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
            console.log('Download URL:', downloadURL);
            setUploadProgress(100);
            setIsUploading(false); // Upload done
            setUploadedImageUrl(downloadURL); // Store the URL
            callGenerateCaptionFunction(downloadURL); // Trigger caption generation
          }).catch((urlError) => {
            console.error("Get URL Error:", urlError);
            setError(`Upload OK, get URL fail: ${urlError.message}`);
            setFunctionResponse(''); setIsLoading(false); setIsUploading(false); setUploadProgress(0);
          });
        }
      );
    } catch (e: any) {
       console.error("Upload prep error:", e); setError(`Error: ${e.message}`);
       setFunctionResponse(''); setIsLoading(false); setIsUploading(false); setUploadProgress(0);
    }
  };

  // --- Calculate display dimensions ---
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  const maxDisplayWidth = windowWidth * 0.90;
  const maxDisplayHeight = windowHeight * 0.45;
  let displayWidth: number | null = null;
  let displayHeight: number | null = null;
  if (selectedImageWidth && selectedImageHeight && selectedImageWidth > 0 && selectedImageHeight > 0) {
    const scaleX = maxDisplayWidth / selectedImageWidth; const scaleY = maxDisplayHeight / selectedImageHeight;
    const finalScale = Math.min(scaleX, scaleY);
    displayWidth = selectedImageWidth * finalScale; displayHeight = selectedImageHeight * finalScale;
  }

  // --- Render UI ---
  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>AI Caption Generator</Text>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.pickButton, isLoading ? styles.buttonDisabled : {}]} onPress={()=>pickImage(false)} disabled={isLoading} >
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.cameraButton, isLoading ? styles.buttonDisabled : {}]} onPress={()=>pickImage(true)} disabled={isLoading} >
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {/* Image Display */}
        {selectedImageUri && displayWidth && displayHeight ? (
          <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
            <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} resizeMode="contain"/>
            {isUploading && (
                 <View style={styles.imageLoadingOverlay}>
                     <ActivityIndicator size="large" color={themeColors.textLight} />
                     <Text style={styles.progressTextOverlay}>{`Uploading: ${Math.round(uploadProgress)}%`}</Text>
                 </View>
            )}
          </View>
        ) : (
          <View style={[styles.imageContainer, styles.imagePlaceholder, { width: maxDisplayWidth, height: 200 }]}>
            <Text style={styles.placeholderText}>Select or take an image</Text>
          </View>
        )}

        {/* Generate Button (Show if image selected and no caption yet) */}
        {selectedImageUri && !generatedCaption && !isLoading && !isGenerating && (
          <TouchableOpacity style={[styles.button, styles.generateButton]} onPress={handleUploadAndGenerate}>
            <Text style={styles.buttonText}>Generate Caption</Text>
          </TouchableOpacity>
        )}

        {/* Loading / Status Area */}
        {(isLoading || isGenerating) && !isUploading && ( // Show if generating, hide if only uploading (covered by overlay)
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.pink} />
            <Text style={styles.progressText}>{functionResponse}</Text>
          </View>
        )}

        {/* Caption Display & Actions */}
        {!isLoading && !isGenerating && generatedCaption && (
          <View style={[styles.responseContainer, styles.captionBox]}>
            <Text style={styles.responseText}>Generated Caption:</Text>
            {/* Use TextInput for selectable/copyable text */}
            <TextInput
                style={styles.captionText}
                value={generatedCaption || ""} // Ensure value is always string
                multiline={true}
                editable={false} // Make it non-editable but selectable by default
                // selectable={true} // <<< REMOVE THIS LINE >>>
            />
            <View style={styles.captionActions}>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.refreshButton]}
                  onPress={() => callGenerateCaptionFunction(uploadedImageUrl)} // Re-run generation
                  disabled={!uploadedImageUrl} // Disable if no URL
                >
                   <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                   <Text style={styles.buttonSmallText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.buttonSmall, styles.confirmButton]}
                  onPress={() => Alert.alert("Confirmed", "Caption confirmed (add save logic later).")} // Placeholder action
                >
                    <Ionicons name="checkmark-circle-outline" size={18} color={themeColors.textLight} />
                    <Text style={styles.buttonSmallText}>Confirm</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error message */}
        {!isLoading && error && (
          <View style={[styles.responseContainer, styles.errorBox]}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorText} selectable={true}>{error}</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// --- Styles (Adapted from image.tsx, added caption styles) ---
const windowHeight = Dimensions.get("window").height;
const styles = StyleSheet.create({
    gradientWrapper: { flex: 1, },
    scrollContentContainer: { alignItems: 'center', paddingBottom: 30, paddingTop: 30 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 25, color: themeColors.textLight, textAlign: 'center', paddingHorizontal: 20 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginBottom: 20, alignSelf: 'center' },
    button: {
        paddingVertical: 12, paddingHorizontal: 15, borderRadius: 25, minHeight: 48, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 8,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    },
    pickButton: { backgroundColor: themeColors.pink },
    cameraButton: { backgroundColor: themeColors.blue },
    generateButton: {
         backgroundColor: themeColors.pink, width: '80%', marginTop: 25, marginBottom: 15, alignSelf: 'center', flex: 0,
         shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
         boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    },
    buttonDisabled: { opacity: 0.5, },
    buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center', },
    imageContainer: { marginVertical: 20, borderRadius: 15, overflow: 'hidden', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: themeColors.pink, position: 'relative' }, // Added position relative
    imagePlaceholder: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: themeColors.grey },
    placeholderText: { color: themeColors.textSecondary },
    selectedImage: { width: '100%', height: '100%', },
    imageLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderRadius: 12, }, // Adjusted border radius
    progressTextOverlay: { marginTop: 10, fontSize: 14, color: themeColors.textLight, fontWeight: '500' },
    loadingContainer: { alignItems: 'center', paddingVertical: 40, },
    progressText: { marginTop: 15, fontSize: 14, color: themeColors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
    responseContainer: { padding: 15, borderRadius: 10, width: '90%', borderWidth: 0, alignSelf: 'center', marginVertical: 10, backgroundColor: themeColors.darkGrey },
    errorBox: { backgroundColor: '#5c2020', borderColor: themeColors.errorRed, borderWidth: 1 },
    captionBox: { backgroundColor: themeColors.darkGrey, },
    responseText: { fontWeight: 'bold', marginBottom: 10, color: themeColors.textLight, fontSize: 16, },
    errorTitle: { fontWeight: 'bold', marginBottom: 5, color: themeColors.errorRed, fontSize: 15, },
    errorText: { color: '#ffb0b0', fontSize: 14, },
    // --- Caption Specific Styles ---
    captionText: {
        fontSize: 15,
        color: themeColors.textLight,
        backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle background
        padding: 10,
        borderRadius: 5,
        minHeight: 60, // Ensure some height
        textAlignVertical: 'top', // Align text top for multiline
        marginBottom: 15,
    },
    captionActions: {
        flexDirection: 'row',
        justifyContent: 'space-around', // Or 'flex-end'
        marginTop: 10,
    },
    buttonSmall: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 2.0, elevation: 3,
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.20)',
    },
    buttonSmallText: {
         color: themeColors.textLight,
         fontSize: 14,
         fontWeight: 'bold',
         marginLeft: 6,
    },
    refreshButton: {
        backgroundColor: themeColors.blue,
    },
    confirmButton: {
        backgroundColor: themeColors.successGreen, // Use a different color for confirm
    }
});