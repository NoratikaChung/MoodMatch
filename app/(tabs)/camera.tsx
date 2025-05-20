// File: app/(tabs)/camera.tsx (Comprehensive Fixes)

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ActivityIndicator, Image, Alert,
  TouchableOpacity, Platform, Dimensions, ScrollView, TextInput,
  StatusBar
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
import { Audio } from "expo-av";

// --- Interfaces (Keep As Is) ---
interface AnalysisResult { labels: Array<{ description: string; score: number }>; safety: { adult: string; spoof: string; medical: string; violence: string; racy: string; }; }
interface AnalyzeImageData { imageUrl: string; }
interface SpotifyRequestData { labels: Array<{ description: string; score: number }>; }
interface RecommendedTrack { id: string; name: string; artists: string[]; previewUrl: string | null; spotifyUrl: string; albumImageUrl: string | null; }
interface SpotifyRecommendationsResult { tracks: RecommendedTrack[]; }
interface GenerateCaptionData { imageUrl: string; }
interface GenerateCaptionResult { caption: string | null; }

type PostCreationStage =
  | "initial" | "uploading" | "imageUploaded" | "selectingSong" | "selectingCaption"
  | "songConfirmed" | "captionConfirmed" | "bothConfirmed";

export default function CameraScreen() {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
  const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [screenTitle, setScreenTitle] = useState("Create Post");
  const [currentStage, setCurrentStage] = useState<PostCreationStage>("initial");
  const [chosenSong, setChosenSong] = useState<RecommendedTrack | null>(null);
  const [chosenCaption, setChosenCaption] = useState<string | null>(null);
  const [isProcessingSong, setIsProcessingSong] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recommendedTracks, setRecommendedTracks] = useState<RecommendedTrack[] | null>(null);
  const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isProcessingCaption, setIsProcessingCaption] = useState(false);
  const [generatedCaptionSuggestions, setGeneratedCaptionSuggestions] = useState<string[] | null>(null);
  const [currentCaptionSuggestion, setCurrentCaptionSuggestion] = useState<string | null>(null);

  const resetForNewImageSelection = () => {
    setSelectedImageUri(null); setSelectedImageWidth(null); setSelectedImageHeight(null);
    setUploadedImageUrl(null); setIsUploading(false); setUploadProgress(0);
    setStatusMessage(""); setError("");
    setCurrentStage("initial"); setChosenSong(null); setChosenCaption(null);
    setIsProcessingSong(false); setAnalysisResult(null); setRecommendedTracks(null);
    if (playbackInstance) { playbackInstance.unloadAsync(); setPlaybackInstance(null); }
    setCurrentlyPlayingId(null); setIsPlayingAudio(false);
    setIsProcessingCaption(false); setGeneratedCaptionSuggestions(null); setCurrentCaptionSuggestion(null);
    setScreenTitle("Create Post");
  };

  const pickImageFromDevice = async (useCamera: boolean = false) => {
    resetForNewImageSelection();
    try {
      let result: ImagePicker.ImagePickerResult;
      const options: ImagePicker.ImagePickerOptions = { allowsEditing: false, quality: 0.8 };
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Photo library access needed."); return; }
        result = await ImagePicker.launchImageLibraryAsync({...options, mediaTypes: 'Images' as ImagePicker.MediaTypeOptions });
      }
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImageUri(asset.uri);
        if (asset.width && asset.height) { setSelectedImageWidth(asset.width); setSelectedImageHeight(asset.height); }
        await handleImageUpload(asset.uri);
      }
    } catch (e: any) { console.error("pickImageFromDevice error:", e); setError(`Error selecting image: ${e.message}`); }
  };

  const handleImageUpload = async (imageUri: string) => {
    if (!imageUri) return;
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert("Not Authenticated", "Please log in."); return; }
    setIsUploading(true); setError(""); setStatusMessage("Starting upload..."); setUploadProgress(0);
    setUploadedImageUrl(null); setCurrentStage("uploading"); // Set to uploading stage
    try {
      const response = await fetch(imageUri); const blob = await response.blob();
      let ext = "jpg"; if (blob.type?.startsWith("image/")) { ext = blob.type.split("/")[1] === 'jpeg' ? 'jpg' : blob.type.split("/")[1]; }
      const filename = `${uuidv4()}.${ext}`; const path = `user_uploads/${currentUser.uid}/${filename}`;
      const storageRef = ref(storage, path); const task = uploadBytesResumable(storageRef, blob);
      task.on('state_changed', (snap) => {
          const prog = (snap.bytesTransferred / snap.totalBytes) * 100;
          setUploadProgress(prog); setStatusMessage(`Uploading: ${Math.round(prog)}%`);
        }, (err) => {
          console.error("Upload Err:", err); setError(`Upload failed: ${err.message}`);
          setIsUploading(false); setStatusMessage(""); setCurrentStage("initial"); // Revert to initial on fail
        }, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploadedImageUrl(url); setStatusMessage("Image uploaded! Choose an action below.");
          setIsUploading(false); setCurrentStage("imageUploaded"); setScreenTitle("Choose Recommendation");
        });
    } catch (e: any) {
      console.error("Upload Prep Err:", e); setError(`Upload error: ${e.message}`);
      setIsUploading(false); setStatusMessage(""); setCurrentStage("initial"); // Revert to initial on fail
    }
  };

  const initiateGetSongs = () => {
    if (!uploadedImageUrl) return;
    setIsProcessingSong(true); setError(""); setRecommendedTracks(null);
    setStatusMessage("👁️ Analyzing image for songs..."); setCurrentStage("selectingSong"); setScreenTitle("Select a Song");
    callAnalyzeAndGetSongs();
  };

  const callAnalyzeAndGetSongs = async () => {
    // ... (Keep as is)
    try {
      const analyzeFn = httpsCallable<AnalyzeImageData, AnalysisResult>(functions, "analyzeImage");
      const analysisData = (await analyzeFn({ imageUrl: uploadedImageUrl! })).data as AnalysisResult;
      setAnalysisResult(analysisData); setStatusMessage("🎧 Finding matching songs...");
      if (!analysisData?.labels || analysisData.labels.length === 0) { throw new Error("Analysis returned no labels."); }
      const recsFn = httpsCallable<SpotifyRequestData, SpotifyRecommendationsResult>(functions, "getSpotifyRecommendations");
      const recsData = (await recsFn({ labels: analysisData.labels })).data as SpotifyRecommendationsResult;
      if (recsData?.tracks && recsData.tracks.length > 0) { setRecommendedTracks(recsData.tracks); setStatusMessage("Select a song or retry."); }
      else { setRecommendedTracks([]); setStatusMessage("🤔 No songs found. Retry?"); }
    } catch (e: any) { console.error("Song Rec Err:", e); setError(`Song recommendation failed: ${e.message}`); setStatusMessage("Error finding songs. Retry?"); }
    finally { setIsProcessingSong(false); }
  };

  const playPreview = async (track: RecommendedTrack) => { /* ... (Keep as is) ... */ };
  useEffect(() => { return () => { playbackInstance?.unloadAsync(); }; }, [playbackInstance]);

  const initiateGetCaption = () => {
    if (!uploadedImageUrl) return;
    setIsProcessingCaption(true); setError(""); setCurrentCaptionSuggestion(null); setGeneratedCaptionSuggestions(null);
    setStatusMessage("✨ Generating caption..."); setCurrentStage("selectingCaption"); setScreenTitle("Select a Caption");
    callGenerateCaption();
  };

  const callGenerateCaption = async () => {
    // ... (Keep as is)
    try {
      const captionFn = httpsCallable<GenerateCaptionData, GenerateCaptionResult>(functions, 'generateCaption');
      const result = (await captionFn({ imageUrl: uploadedImageUrl! })).data as GenerateCaptionResult;
      if (result?.caption) {
        setCurrentCaptionSuggestion(result.caption); setGeneratedCaptionSuggestions([result.caption]);
        setStatusMessage("Caption generated. Confirm or retry.");
      } else { setCurrentCaptionSuggestion("Could not generate caption. Retry?"); setGeneratedCaptionSuggestions([]); }
    } catch (e: any) { console.error("Caption Gen Err:", e); setError(`Caption failed: ${e.message}`); setStatusMessage("Error. Retry?"); }
    finally { setIsProcessingCaption(false); }
  };

  const handleConfirmSong = (track: RecommendedTrack) => {
    setChosenSong(track); setRecommendedTracks(null);
    if (chosenCaption) { setCurrentStage("bothConfirmed"); setScreenTitle("Review & Post"); setStatusMessage(`Song & Caption Confirmed!`);}
    else { setCurrentStage("songConfirmed"); setScreenTitle("Song Confirmed!"); setStatusMessage(`Song: ${track.name}. Add a caption or post.`); }
  };

  const handleConfirmCaption = () => {
    if (!currentCaptionSuggestion) return;
    setChosenCaption(currentCaptionSuggestion);
    setCurrentCaptionSuggestion(null); setGeneratedCaptionSuggestions(null);
    if (chosenSong) { setCurrentStage("bothConfirmed"); setScreenTitle("Review & Post"); setStatusMessage(`Song & Caption Confirmed!`);}
    else { setCurrentStage("captionConfirmed"); setScreenTitle("Caption Confirmed!"); setStatusMessage(`Caption Confirmed! Add a song or post.`); }
  };

  const handlePost = () => {
    if (!uploadedImageUrl) { Alert.alert("Error", "No image uploaded."); return; }
    const postData = {
      imageUrl: uploadedImageUrl, userId: auth.currentUser?.uid,
      song: chosenSong ? { id: chosenSong.id, name: chosenSong.name, artists: chosenSong.artists } : null,
      caption: chosenCaption, createdAt: new Date().toISOString(),
    };
    console.log("POSTING DATA:", postData);
    Alert.alert("Post Submitted (Simulated)", "Your content would be posted now!");
    resetForNewImageSelection();
  };

  const windowWidth = Dimensions.get('window').width; const windowHeight = Dimensions.get('window').height;
  const maxDisplayWidth = windowWidth * 0.90; const maxDisplayHeight = windowHeight * 0.35;
  let displayWidth: number | null = null; let displayHeight: number | null = null;
  if (selectedImageWidth && selectedImageHeight && selectedImageWidth > 0 && selectedImageHeight > 0) {
    const aspectRatio = selectedImageWidth / selectedImageHeight; displayWidth = maxDisplayWidth;
    displayHeight = displayWidth / aspectRatio;
    if (displayHeight > maxDisplayHeight) { displayHeight = maxDisplayHeight; displayWidth = displayHeight * aspectRatio; }
  }

  return (
    <LinearGradient colors={themeColors.backgroundGradient} style={styles.gradientWrapper}>
      <ScrollView contentContainerStyle={styles.scrollContentContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{screenTitle}</Text>

        {/* --- Initial Image Pickers --- */}
        {currentStage === "initial" && !isUploading && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.pickButton]} onPress={() => pickImageFromDevice(false)} >
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={() => pickImageFromDevice(true)} >
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- Image Display Area --- */}
        {/* Show placeholder only at the very start AND not uploading */}
        {currentStage === "initial" && !selectedImageUri && !isUploading && (
             <View style={[styles.imageContainer, styles.imagePlaceholder, { width: maxDisplayWidth, height: 200 }]}>
                <Text style={styles.placeholderText}>Select or take an image</Text>
            </View>
        )}
        {/* Show image once selected, or placeholder if upload fails and reverts stage */}
        {selectedImageUri && (currentStage !== "initial" || isUploading) && displayWidth && displayHeight && (
          <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
            <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} resizeMode="contain"/>
            {isUploading && ( // Upload progress overlay
                 <View style={styles.imageLoadingOverlay}>
                     <ActivityIndicator size="large" color={themeColors.textLight} />
                     <Text style={styles.progressTextOverlay}>{statusMessage.startsWith("Uploading") ? statusMessage : `Uploading: ${Math.round(uploadProgress)}%`}</Text>
                 </View>
            )}
          </View>
        )}
        {/* Show a general loading indicator below image during upload if not overlayed */}
        {isUploading && (
            <View style={styles.loadingFullWidth}>
                <ActivityIndicator size="large" color={themeColors.pink} />
                <Text style={styles.progressText}>{statusMessage}</Text>
            </View>
        )}


        {/* --- Display Chosen Items (Only if they exist) --- */}
        {(chosenSong || chosenCaption) && (
          <View style={styles.chosenItemsContainer}>
              {chosenSong && (
                  <View style={styles.chosenItem}>
                      <Ionicons name="musical-notes" size={20} color={themeColors.pink} style={{marginRight: 5}}/>
                      <Text style={styles.chosenItemText} numberOfLines={1}>Song: {chosenSong.name}</Text>
                  </View>
              )}
              {chosenCaption && (
                   <View style={styles.chosenItem}>
                      <Ionicons name="chatbubbles" size={20} color={themeColors.blue} style={{marginRight: 5}}/>
                      <Text style={styles.chosenItemText} numberOfLines={2}>Caption: {chosenCaption}</Text>
                   </View>
              )}
          </View>
        )}

        {/* --- Status Message Display (Contextual, not during focused processing) --- */}
        {statusMessage && !error && !isUploading && !isProcessingSong && !isProcessingCaption &&
         <Text style={styles.statusMessageText}>{statusMessage}</Text>
        }
        {error && <Text style={[styles.statusMessageText, styles.errorTextDisplay]}>{error}</Text>}


        {/* --- STAGE: Image Uploaded - Show initial choices --- */}
        {currentStage === "imageUploaded" && !isUploading && uploadedImageUrl && (
          <View style={styles.actionChoiceContainer}>
            <TouchableOpacity style={[styles.button, styles.songButton]} onPress={initiateGetSongs} disabled={isProcessingSong || isProcessingCaption}>
              <Ionicons name="musical-notes-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} />
              <Text style={styles.buttonText}>Get Songs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.captionButton]} onPress={initiateGetCaption} disabled={isProcessingSong || isProcessingCaption}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} />
              <Text style={styles.buttonText}>Get Caption</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- STAGE: Selecting Song --- */}
        {currentStage === "selectingSong" && (
          <View style={styles.resultsSection}>
            {isProcessingSong && <View style={styles.loadingFullWidth}><ActivityIndicator size="large" color={themeColors.pink} /><Text style={styles.progressText}>{statusMessage}</Text></View>}
            {!isProcessingSong && recommendedTracks && (
              <>
                <Text style={styles.responseText}>Select a Song:</Text>
                <ScrollView style={styles.recommendationsScrollContainer} nestedScrollEnabled={true}>
                  {recommendedTracks.map((track: RecommendedTrack) => (
                    <TouchableOpacity key={track.id} style={styles.trackItemPressable} onPress={() => handleConfirmSong(track)}>
                        {track.albumImageUrl ? <Image source={{uri: track.albumImageUrl}} style={styles.albumArt}/> : <View style={[styles.albumArt, styles.albumArtPlaceholder]} />}
                        <View style={styles.trackInfo}><Text style={styles.trackName} numberOfLines={1}>{track.name}</Text><Text style={styles.trackArtist} numberOfLines={1}>{track.artists.join(", ")}</Text></View>
                        {track.previewUrl && ( <TouchableOpacity onPress={(e) => { e.stopPropagation(); playPreview(track);}} style={styles.playButton}>
                            <Ionicons name={currentlyPlayingId === track.id && isPlayingAudio ? "pause-circle" : "play-circle"} size={34} color={currentlyPlayingId === track.id && isPlayingAudio ? themeColors.blue : themeColors.pink}/>
                          </TouchableOpacity>)}
                        {!track.previewUrl && <View style={styles.playButtonPlaceholder} />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            {!isProcessingSong && recommendedTracks?.length === 0 && <Text style={styles.infoText}>No songs found.</Text>}
            {!isProcessingSong && (
                <TouchableOpacity style={[styles.buttonSmall, styles.retryButton]} onPress={initiateGetSongs}>
                    <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                    <Text style={styles.buttonSmallText}>Retry Songs</Text>
                </TouchableOpacity>
            )}
          </View>
        )}

        {/* --- STAGE: Selecting Caption --- */}
        {currentStage === "selectingCaption" && (
          <View style={styles.resultsSection}>
            {isProcessingCaption && <View style={styles.loadingFullWidth}><ActivityIndicator size="large" color={themeColors.blue} /><Text style={styles.progressText}>{statusMessage}</Text></View>}
            {!isProcessingCaption && currentCaptionSuggestion && (
              <>
                <Text style={styles.responseText}>Suggested Caption:</Text>
                <TextInput style={styles.captionTextDisplay} value={currentCaptionSuggestion} multiline editable={false} />
                <View style={styles.captionActions}>
                    <TouchableOpacity style={[styles.buttonSmall, styles.retryButton]} onPress={initiateGetCaption}>
                        <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                        <Text style={styles.buttonSmallText}>Retry Caption</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.buttonSmall, styles.confirmButton]} onPress={handleConfirmCaption}>
                        <Ionicons name="checkmark" size={18} color={themeColors.textLight} />
                        <Text style={styles.buttonSmallText}>Confirm Caption</Text>
                    </TouchableOpacity>
                </View>
              </>
            )}
            {!isProcessingCaption && !currentCaptionSuggestion && generatedCaptionSuggestions?.length === 0 && <Text style={styles.infoText}>No caption generated.</Text>}
            {!isProcessingCaption && !currentCaptionSuggestion && (
                 <TouchableOpacity style={[styles.buttonSmall, styles.retryButton]} onPress={initiateGetCaption}>
                    <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                    <Text style={styles.buttonSmallText}>Retry Caption</Text>
                </TouchableOpacity>
            )}
          </View>
        )}

        {/* --- Button to Add Other Recommendation --- */}
        {uploadedImageUrl && !isUploading && ( // Check if image is generally ready
            <>
                {currentStage === "songConfirmed" && !chosenCaption && !isProcessingCaption && ( // Show if song confirmed, no caption yet, and not currently getting caption
                    <TouchableOpacity style={[styles.button, styles.addOtherButton]} onPress={initiateGetCaption}>
                        <Ionicons name="add-circle-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}}/>
                        <Text style={styles.buttonText}>Add Caption</Text>
                    </TouchableOpacity>
                )}
                {currentStage === "captionConfirmed" && !chosenSong && !isProcessingSong && ( // Show if caption confirmed, no song yet, and not currently getting song
                    <TouchableOpacity style={[styles.button, styles.addOtherButton]} onPress={initiateGetSongs}>
                        <Ionicons name="add-circle-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}}/>
                        <Text style={styles.buttonText}>Add Song</Text>
                    </TouchableOpacity>
                )}
            </>
        )}

        {/* --- Post Button --- */}
        {uploadedImageUrl && !isUploading && !isProcessingSong && !isProcessingCaption &&
         (currentStage === "imageUploaded" || currentStage === "songConfirmed" || currentStage === "captionConfirmed" || currentStage === "bothConfirmed") && (
            <TouchableOpacity style={[styles.button, styles.postButton]} onPress={handlePost}>
                <Ionicons name="send-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}}/>
                <Text style={styles.buttonText}>Post</Text>
            </TouchableOpacity>
        )}

        {/* --- Start Over Button --- */}
        {currentStage !== "initial" && !isUploading && (
            <TouchableOpacity style={[styles.buttonSmall, styles.clearImageButton]} onPress={resetForNewImageSelection}>
                <Ionicons name="trash-outline" size={18} color={themeColors.textLight} />
                <Text style={styles.buttonSmallText}>Start Over</Text>
            </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// --- Styles (Add progressText) ---
const styles = StyleSheet.create({
    progressText: { // Added this style
        marginTop: 10,
        fontSize: 14,
        color: themeColors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    // ... (all previous styles from the last "full code" response should be here)
    gradientWrapper: { flex: 1, }, scrollContentContainer: { alignItems: 'center', paddingBottom: 30, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 20) + 10 : 50, }, title: { fontSize: 24, fontWeight: '600', marginBottom: 20, color: themeColors.textLight, textAlign: 'center', }, buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginBottom: 20, }, button: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 25, minHeight: 50, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, flexDirection: 'row', }, pickButton: { backgroundColor: themeColors.pink }, cameraButton: { backgroundColor: themeColors.blue }, buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center', }, imageContainer: { marginVertical: 15, borderRadius: 15, overflow: 'hidden', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: themeColors.pink, position: 'relative', backgroundColor: "rgba(0,0,0,0.1)" }, imagePlaceholder: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: themeColors.grey, }, placeholderText: { color: themeColors.textSecondary, fontSize: 16, }, selectedImage: { width: '100%', height: '100%', }, imageLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 13, }, progressTextOverlay: { marginTop: 10, fontSize: 14, color: themeColors.textLight, fontWeight: '500', }, statusMessageText: { fontSize: 15, color: themeColors.textSecondary, marginVertical: 10, textAlign: 'center', paddingHorizontal: 10, }, errorTextDisplay: { color: themeColors.errorRed, fontWeight: '500'}, actionChoiceContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginTop: 15, marginBottom: 15, }, songButton: { backgroundColor: themeColors.pink, maxWidth: '48%' }, captionButton: { backgroundColor: themeColors.blue, maxWidth: '48%' }, resultsSection: { width: '90%', marginVertical: 15, alignItems: 'center' }, responseText: { fontWeight: 'bold', marginBottom: 10, color: themeColors.textLight, fontSize: 17, alignSelf: 'flex-start' }, infoText: { color: themeColors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 20, marginBottom: 10}, recommendationsScrollContainer: { maxHeight: Dimensions.get("window").height * 0.25, width: "100%", borderWidth:1, borderColor: themeColors.grey, borderRadius: 8, padding:5, marginBottom: 10 }, trackItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.1)" }, trackItemPressable: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.1)", paddingHorizontal: 5, borderRadius: 5, marginVertical: 2, backgroundColor: 'rgba(255,255,255,0.03)'}, albumArt: { width: 40, height: 40, borderRadius: 4, marginRight: 10 }, albumArtPlaceholder: { backgroundColor: themeColors.grey, opacity: 0.5, width: 40, height: 40, borderRadius: 4, marginRight: 10 }, trackInfo: { flex: 1, marginRight: 10 }, trackName: { fontSize: 14, fontWeight: "600", color: themeColors.textLight, marginBottom: 2 }, trackArtist: { fontSize: 12, color: themeColors.textSecondary }, playButton: { padding: 5, marginLeft: 'auto' }, playButtonPlaceholder: { width: 44, height: 44, marginLeft: 'auto' }, captionTextDisplay: { fontSize: 15, color: themeColors.textLight, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 10, borderRadius: 5, minHeight: 80, textAlignVertical: 'top', marginBottom: 15, width: '100%' }, captionActions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 0 }, buttonSmall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 2.0, elevation: 3, marginHorizontal: 5 }, buttonSmallText: { color: themeColors.textLight, fontSize: 14, fontWeight: 'bold', marginLeft: 6 }, retryButton: { backgroundColor: themeColors.grey, marginBottom:10 }, confirmButton: { backgroundColor: themeColors.successGreen }, chosenItemsContainer: { width: '90%', marginVertical: 15, padding: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth:1, borderColor: themeColors.grey }, chosenItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, }, chosenItemText: { color: themeColors.textLight, fontSize: 15, flexShrink: 1 }, addOtherButton: { backgroundColor: themeColors.infoBlue, width: 'auto', alignSelf: 'center', marginVertical: 10, paddingHorizontal: 30, flex: undefined }, postButton: { backgroundColor: themeColors.successGreen, width: 'auto', alignSelf: 'center', marginVertical: 10, marginTop: 20, paddingHorizontal: 50, flex: undefined }, clearImageButton: { backgroundColor: themeColors.errorRed, paddingHorizontal: 20, marginVertical: 20, alignSelf: 'center', width: 'auto', flex: undefined }, loadingFullWidth: { width: '100%', alignItems: 'center', marginVertical: 20,},
});