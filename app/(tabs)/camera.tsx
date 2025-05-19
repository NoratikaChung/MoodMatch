// File: app/(tabs)/camera.tsx (Corrected: Two distinct buttons, TS assertions)

import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet, Text, View, ActivityIndicator, Image, Alert,
  TouchableOpacity, Platform, Dimensions, ScrollView, TextInput,
  StatusBar
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { auth, storage, functions } from "../../firebaseConfig"; // Adjust path if needed
import { httpsCallable } from "firebase/functions";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { themeColors } from "../../styles/theme"; // Adjust path if needed
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";

// --- Interfaces ---
interface AnalysisResult {
  labels: Array<{ description: string; score: number }>;
  safety: { adult: string; spoof: string; medical: string; violence: string; racy: string; };
}
interface AnalyzeImageData { imageUrl: string; }

interface SpotifyRequestData { labels: Array<{ description: string; score: number }>; }
interface RecommendedTrack {
  id: string; name: string; artists: string[]; previewUrl: string | null;
  spotifyUrl: string; albumImageUrl: string | null;
}
interface SpotifyRecommendationsResult { tracks: RecommendedTrack[]; }

interface GenerateCaptionData { imageUrl: string; }
interface GenerateCaptionResult { caption: string | null; }


export default function CameraScreen() {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(null);
  const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const [showActionChoice, setShowActionChoice] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [recommendedTracks, setRecommendedTracks] = useState<RecommendedTrack[] | null>(null);
  const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(null);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const [generatedCaption, setGeneratedCaption] = useState<string | null>(null);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [screenTitle, setScreenTitle] = useState("Image Options");

  const resetForNewImage = () => {
    setSelectedImageUri(null); setSelectedImageWidth(null); setSelectedImageHeight(null);
    setUploadedImageUrl(null); setIsLoading(false); setUploadProgress(0);
    setStatusMessage(""); setError(""); setShowActionChoice(false);
    setAnalysisResult(null); setRecommendedTracks(null);
    if (playbackInstance) { playbackInstance.unloadAsync(); setPlaybackInstance(null); }
    setCurrentlyPlayingId(null); setIsPlayingAudio(false);
    setGeneratedCaption(null); setIsGeneratingCaption(false);
    setScreenTitle("Image Options");
  };

  const pickImageFromDevice = async (useCamera: boolean = false) => {
    resetForNewImage();
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Camera access needed."); return; }
        result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.9 });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Permission Required", "Photo library access needed."); return; }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'Images' as ImagePicker.MediaTypeOptions, allowsEditing: false, quality: 0.9 });
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
    setIsLoading(true); setError(""); setStatusMessage("Starting upload..."); setUploadProgress(0);
    setUploadedImageUrl(null); setShowActionChoice(false);
    try {
      const response = await fetch(imageUri); const blob = await response.blob();
      let ext = "jpg"; if (blob.type?.startsWith("image/")) { ext = blob.type.split("/")[1] === 'jpeg' ? 'jpg' : blob.type.split("/")[1]; }
      const filename = `${uuidv4()}.${ext}`; const path = `user_uploads/${currentUser.uid}/${filename}`;
      const storageRef = ref(storage, path); const task = uploadBytesResumable(storageRef, blob);
      task.on('state_changed', (snap) => {
          const prog = (snap.bytesTransferred / snap.totalBytes) * 100;
          setUploadProgress(prog); setStatusMessage(`Uploading: ${Math.round(prog)}%`);
        }, (err) => {
          console.error("Upload Err:", err); setError(`Upload failed: ${err.message}`); setIsLoading(false); setStatusMessage("");
        }, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploadedImageUrl(url); setStatusMessage("Upload complete! Choose an action.");
          setIsLoading(false); setShowActionChoice(true); // <<< SHOW CHOICES
        });
    } catch (e: any) { console.error("Upload Prep Err:", e); setError(`Upload error: ${e.message}`); setIsLoading(false); setStatusMessage("");}
  };

  const handleGetSongRecommendations = async () => {
    if (!uploadedImageUrl) { setError("No image uploaded."); return; }
    setShowActionChoice(false); setGeneratedCaption(null); setIsLoading(true); setError("");
    setAnalysisResult(null); setRecommendedTracks(null); setStatusMessage("👁️ Analyzing image for songs...");
    setScreenTitle("Song Recommendations");
    try {
      const analyzeFn = httpsCallable<AnalyzeImageData, AnalysisResult>(functions, "analyzeImage");
      const analysisData = (await analyzeFn({ imageUrl: uploadedImageUrl })).data as AnalysisResult; // TS Assertion
      setAnalysisResult(analysisData); setStatusMessage("🎧 Finding matching songs...");
      if (!analysisData?.labels || analysisData.labels.length === 0) { throw new Error("Analysis returned no labels."); }
      const recsFn = httpsCallable<SpotifyRequestData, SpotifyRecommendationsResult>(functions, "getSpotifyRecommendations");
      const recsData = (await recsFn({ labels: analysisData.labels })).data as SpotifyRecommendationsResult; // TS Assertion
      if (recsData?.tracks && recsData.tracks.length > 0) { setRecommendedTracks(recsData.tracks); setStatusMessage("🎶 Songs Found!"); }
      else { setRecommendedTracks([]); setStatusMessage("🤔 Couldn't find songs."); }
    } catch (e: any) { console.error("Song Rec Err:", e); setError(`Song rec failed: ${e.message}`); setStatusMessage("");
    } finally { setIsLoading(false); }
  };

  const playPreview = async (track: RecommendedTrack) => {
    if (!track.previewUrl) { Alert.alert("No Preview", "No audio preview available."); return; }
    setIsPlayingAudio(false);
    if (playbackInstance && currentlyPlayingId !== track.id) { await playbackInstance.unloadAsync(); setPlaybackInstance(null); setCurrentlyPlayingId(null); }
    if (playbackInstance && currentlyPlayingId === track.id) {
      const status = await playbackInstance.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) { await playbackInstance.pauseAsync(); setIsPlayingAudio(false); }
        else { await playbackInstance.playAsync(); setIsPlayingAudio(true); }
      } else { setPlaybackInstance(null); setCurrentlyPlayingId(null); playPreview(track); }
    } else {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound, status } = await Audio.Sound.createAsync({ uri: track.previewUrl }, { shouldPlay: true });
        if (status.isLoaded) {
          setPlaybackInstance(sound); setCurrentlyPlayingId(track.id); setIsPlayingAudio(true);
          sound.setOnPlaybackStatusUpdate((s) => {
            if (s.isLoaded) { setIsPlayingAudio(s.isPlaying); if (s.didJustFinish) { sound.unloadAsync(); setPlaybackInstance(null); setCurrentlyPlayingId(null);}}
            else { if (s.error) console.error(`Playback Err: ${s.error}`); if (currentlyPlayingId === track.id) { setPlaybackInstance(null); setCurrentlyPlayingId(null); setIsPlayingAudio(false);}}});
        } else { throw new Error("Sound not loaded."); }
      } catch (e: any) { console.error("Play Preview Err:", e); Alert.alert("Playback Error", "Could not play audio."); setPlaybackInstance(null); setCurrentlyPlayingId(null); setIsPlayingAudio(false); }
    }
  };
  useEffect(() => { return () => { playbackInstance?.unloadAsync(); }; }, [playbackInstance]);

  const handleGetCaptionRecommendation = async () => {
    if (!uploadedImageUrl) { setError("No image uploaded."); return; }
    setShowActionChoice(false); setRecommendedTracks(null); if (playbackInstance) { playbackInstance.unloadAsync(); setPlaybackInstance(null); }
    setCurrentlyPlayingId(null); setIsPlayingAudio(false); setIsGeneratingCaption(true); setIsLoading(true);
    setError(""); setGeneratedCaption(null); setStatusMessage("✨ Generating caption..."); setScreenTitle("Caption Generator");
    try {
      const captionFn = httpsCallable<GenerateCaptionData, GenerateCaptionResult>(functions, 'generateCaption');
      const result = (await captionFn({ imageUrl: uploadedImageUrl })).data as GenerateCaptionResult; // TS Assertion
      if (result?.caption) { setGeneratedCaption(result.caption); setStatusMessage("Caption generated!"); }
      else { setGeneratedCaption("Could not generate caption."); setStatusMessage(""); }
    } catch (e: any) { console.error("Caption Gen Err:", e); setError(`Caption failed: ${e.message}`); setStatusMessage("");
    } finally { setIsGeneratingCaption(false); setIsLoading(false); }
  };

  const windowWidth = Dimensions.get('window').width; const windowHeight = Dimensions.get('window').height;
  const maxDisplayWidth = windowWidth * 0.90; const maxDisplayHeight = windowHeight * 0.40;
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

        {(!selectedImageUri || recommendedTracks || generatedCaption) && !isLoading && !isGeneratingCaption && (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.button, styles.pickButton]} onPress={() => pickImageFromDevice(false)} >
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.cameraButton]} onPress={() => pickImageFromDevice(true)} >
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedImageUri && displayWidth && displayHeight ? (
          <View style={[styles.imageContainer, { width: displayWidth, height: displayHeight }]}>
            <Image source={{ uri: selectedImageUri }} style={styles.selectedImage} resizeMode="contain"/>
            {isLoading && uploadedImageUrl === null && (
                 <View style={styles.imageLoadingOverlay}>
                     <ActivityIndicator size="large" color={themeColors.textLight} />
                     <Text style={styles.progressTextOverlay}>{statusMessage}</Text>
                 </View>
            )}
          </View>
        ) : (
          !isLoading && !isGeneratingCaption && !recommendedTracks && !generatedCaption && (
            <View style={[styles.imageContainer, styles.imagePlaceholder, { width: maxDisplayWidth, height: 200 }]}>
                <Text style={styles.placeholderText}>Select or take an image</Text>
            </View>
          )
        )}

        {/* --- Action Choice Buttons (Post-Upload) --- */}
        {showActionChoice && uploadedImageUrl && !isLoading && !isGeneratingCaption && !recommendedTracks && !generatedCaption && (
          <>
            <Text style={styles.choicePromptText}>
              {statusMessage.includes("Upload complete") ? "What would you like to do?" : statusMessage}
            </Text>
            <View style={styles.actionChoiceContainer}>
              <TouchableOpacity
                style={[styles.button, styles.songButton]}
                onPress={handleGetSongRecommendations}
              >
                <Ionicons name="musical-notes-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>Get Songs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.captionButton]}
                onPress={handleGetCaptionRecommendation}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={themeColors.textLight} style={{marginRight: 8}} />
                <Text style={styles.buttonText}>Get Caption</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
        {/* --- END Action Choice Buttons --- */}


        {/* --- CORRECTED Loading / Status --- */}
        {/* General loader for song analysis or other general loading states */}
        {/* DO NOT show if we are specifically generating a caption */}
        {isLoading && !showActionChoice && !isGeneratingCaption && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.pink} />
            <Text style={styles.progressText}>{statusMessage}</Text>
          </View>
        )}

         {/* Specific loader for caption generation */}
         {isGeneratingCaption && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.blue} />
            <Text style={styles.progressText}>{statusMessage}</Text>
          </View>
        )}
        {/* --- END CORRECTED Loading / Status --- */}

        {/* Song Recommendations Display */}
        {!isLoading && recommendedTracks && (
            <View style={[styles.responseContainer, styles.recommendationsBox]}>
              <Text style={styles.responseText}>Recommended Songs:</Text>
              <ScrollView style={styles.recommendationsScrollContainer} nestedScrollEnabled={true}>
                {recommendedTracks.map((track: RecommendedTrack) => ( // Added type here
                  <View key={track.id} style={styles.trackItem}>
                    {track.albumImageUrl ? <Image source={{uri: track.albumImageUrl}} style={styles.albumArt}/> : <View style={[styles.albumArt, styles.albumArtPlaceholder]} />}
                    <View style={styles.trackInfo}>
                        <Text style={styles.trackName} numberOfLines={1}>{track.name}</Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>{track.artists.join(", ")}</Text>
                    </View>
                    {track.previewUrl && (
                      <TouchableOpacity onPress={() => playPreview(track)} style={styles.playButton}>
                        <Ionicons name={currentlyPlayingId === track.id && isPlayingAudio ? "pause-circle" : "play-circle"} size={34} color={currentlyPlayingId === track.id && isPlayingAudio ? themeColors.blue : themeColors.pink}/>
                      </TouchableOpacity>
                    )}
                    {!track.previewUrl && <View style={styles.playButtonPlaceholder} />}
                  </View>
                ))}
                 {recommendedTracks.length === 0 && <Text style={styles.infoText}>No songs found for this image.</Text>}
              </ScrollView>
                <TouchableOpacity style={[styles.buttonSmall, styles.tryAgainButton]} onPress={resetForNewImage}>
                    <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                    <Text style={styles.buttonSmallText}>Try Another Image</Text>
                </TouchableOpacity>
            </View>
        )}

        {/* Caption Display & Actions */}
        {!isLoading && !isGeneratingCaption && generatedCaption && (
          <View style={[styles.responseContainer, styles.captionBox]}>
            <Text style={styles.responseText}>Generated Caption:</Text>
            <TextInput style={styles.captionText} value={generatedCaption || ""} multiline={true} editable={false} />
            <View style={styles.captionActions}>
                <TouchableOpacity style={[styles.buttonSmall, styles.refreshButton]} onPress={() => handleGetCaptionRecommendation()} disabled={!uploadedImageUrl || isGeneratingCaption}>
                   <Ionicons name="refresh" size={18} color={themeColors.textLight} />
                   <Text style={styles.buttonSmallText}>Regenerate</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={[styles.buttonSmall, styles.tryAgainButton, {backgroundColor: themeColors.successGreen}]} onPress={resetForNewImage}>
                    <Ionicons name="image-outline" size={18} color={themeColors.textLight} />
                    <Text style={styles.buttonSmallText}>New Image</Text>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Error Message */}
        {!isLoading && !isGeneratingCaption && error && (
          <View style={[styles.responseContainer, styles.errorBox]}>
            <Text style={styles.errorTitle}>Error:</Text>
            <Text style={styles.errorText} selectable={true}>{error}</Text>
          </View>
        )}

        {/* Clear Image Button */}
        {selectedImageUri && uploadedImageUrl && !isLoading && !showActionChoice && !recommendedTracks && !generatedCaption && (
             <TouchableOpacity style={[styles.buttonSmall, styles.clearButton]} onPress={resetForNewImage}>
                <Ionicons name="close-circle-outline" size={18} color={themeColors.textLight} />
                <Text style={styles.buttonSmallText}>Clear Image</Text>
            </TouchableOpacity>
        )}

        <View style={{ height: 50 }} />
      </ScrollView>
    </LinearGradient>
  );
}

// --- Styles (Keep As Is from previous response) ---
const styles = StyleSheet.create({
    gradientWrapper: { flex: 1, },
    scrollContentContainer: { alignItems: 'center', paddingBottom: 30, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 40, },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 25, color: themeColors.textLight, textAlign: 'center', paddingHorizontal: 20 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginBottom: 20 },
    button: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 25, minHeight: 48, alignItems: 'center', justifyContent: 'center', flex: 1, marginHorizontal: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, flexDirection: 'row', },
    pickButton: { backgroundColor: themeColors.pink },
    cameraButton: { backgroundColor: themeColors.blue },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: themeColors.textLight, fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
    imageContainer: { marginVertical: 20, borderRadius: 15, overflow: 'hidden', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: themeColors.pink, position: 'relative', backgroundColor: themeColors.darkGrey },
    imagePlaceholder: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: themeColors.grey },
    placeholderText: { color: themeColors.textSecondary, fontSize: 16 },
    selectedImage: { width: '100%', height: '100%' },
    imageLoadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', borderRadius: 13 },
    progressTextOverlay: { marginTop: 10, fontSize: 14, color: themeColors.textLight, fontWeight: '500' },
    actionChoiceContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '90%', marginTop: 20, marginBottom: 20, },
    songButton: { backgroundColor: themeColors.pink },
    captionButton: { backgroundColor: themeColors.blue },
    choicePromptText: { fontSize: 16, color: themeColors.textSecondary, textAlign: 'center', marginBottom: 15, marginTop: 10, },
    loadingContainer: { alignItems: 'center', paddingVertical: 20 },
    progressText: { marginTop: 10, fontSize: 14, color: themeColors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
    responseContainer: { padding: 15, borderRadius: 10, width: '90%', marginVertical: 10, backgroundColor: themeColors.darkGrey, },
    errorBox: { backgroundColor: "#5c2020", borderColor: themeColors.errorRed, borderWidth: 1 },
    responseText: { fontWeight: 'bold', marginBottom: 10, color: themeColors.textLight, fontSize: 16 },
    errorTitle: { fontWeight: 'bold', marginBottom: 5, color: themeColors.errorRed, fontSize: 15 },
    errorText: { color: '#ffb0b0', fontSize: 14 },
    infoText: { color: themeColors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 10},
    recommendationsBox: {},
    recommendationsScrollContainer: { maxHeight: Dimensions.get("window").height * 0.3, width: "100%" },
    trackItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.1)" },
    albumArt: { width: 45, height: 45, borderRadius: 4, marginRight: 12 },
    albumArtPlaceholder: { backgroundColor: themeColors.grey, opacity: 0.5 },
    trackInfo: { flex: 1, marginRight: 10 },
    trackName: { fontSize: 15, fontWeight: "600", color: themeColors.textLight, marginBottom: 3 },
    trackArtist: { fontSize: 13, color: themeColors.textSecondary },
    playButton: { padding: 5, marginLeft: 'auto' },
    playButtonPlaceholder: { width: 44, height: 44, marginLeft: 'auto' },
    captionBox: {},
    captionText: { fontSize: 15, color: themeColors.textLight, backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: 10, borderRadius: 5, minHeight: 80, textAlignVertical: 'top', marginBottom: 15 },
    captionActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },
    buttonSmall: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.20, shadowRadius: 2.0, elevation: 3, marginHorizontal: 5 },
    buttonSmallText: { color: themeColors.textLight, fontSize: 14, fontWeight: 'bold', marginLeft: 6 },
    refreshButton: { backgroundColor: themeColors.blue },
    tryAgainButton: { backgroundColor: themeColors.grey },
    clearButton: { backgroundColor: themeColors.errorRed, width: '60%', alignSelf: 'center', marginTop: 15},
});