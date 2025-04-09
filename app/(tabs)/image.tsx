import {
    StyleSheet,
    Text,
    View,
    ActivityIndicator,
    Image,
    Alert,
    TouchableOpacity,
    Platform,
    Dimensions,
    ScrollView,
  } from "react-native";
  import React, {useState, useEffect} from "react"; // Added useEffect
  import * as ImagePicker from "expo-image-picker";

  // --- Audio Playback ---
  import {Audio} from "expo-av"; // <<< ADDED for audio
  import {Ionicons} from "@expo/vector-icons"; // <<< ADDED for icons

  // --- Gradient ---
  import {LinearGradient} from "expo-linear-gradient";

  // --- Firebase Imports ---
  import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL,
  } from "firebase/storage";
  import {auth, storage, functions} from "../../firebaseConfig";
  import {httpsCallable} from "firebase/functions";

  // --- Other Imports ---
  import "react-native-get-random-values";
  import {v4 as uuidv4} from "uuid";
  import {themeColors} from "../../styles/theme";

  // --- Interfaces ---
  // (Interfaces remain the same)
  interface AnalysisResult {
    labels: Array<{description: string; score: number}>;
    safety: {
      adult: string;
      spoof: string;
      medical: string;
      violence: string;
      racy: string;
    };
  }
  interface AnalyzeImageData {
    imageUrl: string;
  }
  interface SpotifyRequestData {
    labels: Array<{description: string; score: number}>;
  }
  interface RecommendedTrack {
    id: string;
    name: string;
    artists: string[];
    previewUrl: string | null;
    spotifyUrl: string;
    albumImageUrl: string | null;
  }
  interface SpotifyRecommendationsResult {
    tracks: RecommendedTrack[];
  }

  // --- Component ---
  export default function TabImageScreen() {
    // --- State Variables ---
    const [functionResponse, setFunctionResponse] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
    const [selectedImageWidth, setSelectedImageWidth] = useState<number | null>(
      null,
    );
    const [selectedImageHeight, setSelectedImageHeight] = useState<number | null>(
      null,
    );
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
      null,
    );
    const [recommendedTracks, setRecommendedTracks] = useState<
      RecommendedTrack[] | null
    >(null);

    // <<< --- ADDED Audio State --- >>>
    const [playbackInstance, setPlaybackInstance] = useState<Audio.Sound | null>(
      null,
    );
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(
      null,
    );
    const [isPlaying, setIsPlaying] = useState(false);
    // <<< --- END Audio State --- >>>

    // --- Helper Functions ---
    const resetState = () => {
      setSelectedImageUri(null);
      setSelectedImageWidth(null);
      setSelectedImageHeight(null);
      setFunctionResponse("");
      setError("");
      setUploadProgress(0);
      setAnalysisResult(null);
      setRecommendedTracks(null);
      setIsLoading(false);
      // Stop audio if playing when state resets
      if (playbackInstance) {
        playbackInstance.unloadAsync();
        setPlaybackInstance(null);
        setCurrentlyPlayingId(null);
        setIsPlaying(false);
      }
    };
    // (pickImage and takePicture remain the same)
    const pickImage = async () => {
      console.log("--- pickImage ---");
      resetState();
      // ... implementation
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Need photo library access.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.9,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          if (asset.width && asset.height) {
            console.log(
              "Library Image:",
              asset.uri,
              `(${asset.width}x${asset.height})`,
            );
            setSelectedImageUri(asset.uri);
            setSelectedImageWidth(asset.width);
            setSelectedImageHeight(asset.height);
          } else {
            console.warn("Library asset missing dims.");
            setSelectedImageUri(asset.uri);
          }
        } else {
          console.log("Library cancel.");
        }
      } catch (e: any) {
        console.error("pickImage error:", e);
        Alert.alert("Error", e.message);
      }
    };
    const takePicture = async () => {
      console.log("--- takePicture ---");
      resetState();
      // ... implementation
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Need camera access.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: false,
          quality: 0.9,
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          console.log(
            `Camera image. URI: ${asset.uri}, Dims: ${asset.width}x${asset.height}`,
          );
          if (asset.width && asset.height) {
            setSelectedImageUri(asset.uri);
            setSelectedImageWidth(asset.width);
            setSelectedImageHeight(asset.height);
          } else {
            console.warn("Camera asset missing dims.");
            setSelectedImageUri(asset.uri);
          }
        } else {
          console.log("Camera cancel.");
        }
      } catch (e: any) {
        console.error("takePicture error:", e);
        Alert.alert("Error", e.message);
      }
    };

    // --- Cloud Function Callers ---
    // (callGetRecommendations and callAnalyzeFunction remain the same)
    const callGetRecommendations = async (analysisData: AnalysisResult | null) => {
      if (!analysisData?.labels || analysisData.labels.length === 0) {
        setError("Cannot get recommendations: Missing analysis labels.");
        setIsLoading(false);
        return;
      }
      console.log(
        "Attempting call 'getSpotifyRecommendations'...",
        analysisData.labels.map((l) => l.description),
      );
      setError("");
      setRecommendedTracks(null);
      setFunctionResponse("🎧 Finding matching songs...");

      try {
        const getRecommendationsFunction = httpsCallable<
          SpotifyRequestData,
          SpotifyRecommendationsResult
        >(functions, "getSpotifyRecommendations");
        const result = await getRecommendationsFunction({
          labels: analysisData.labels,
        });
        console.log("Spotify Recommendations Response:", result.data);
        if (result.data?.tracks?.length > 0) {
          setRecommendedTracks(result.data.tracks);
          setFunctionResponse("🎶 Songs Found!");
        } else {
          setRecommendedTracks([]);
          setFunctionResponse("🤔 Couldn't find matching songs.");
        }
      } catch (error: any) {
        console.error("Error calling 'getSpotifyRecommendations':", error);
        let errorMessage = `Recommendation failed: ${error.message}`;
        if (error.code) {
          errorMessage += ` (Code: ${error.code})`;
        }
        if (error.details) {
          console.error("Function error details:", error.details);
        }
        setError(errorMessage);
        setFunctionResponse("");
        setRecommendedTracks(null);
      } finally {
        setIsLoading(false);
      }
    };
    const callAnalyzeFunction = async (imageUrl: string) => {
      if (!imageUrl) {
        setError("Internal Error: Cannot analyze, URL missing.");
        setIsLoading(false);
        return;
      }
      console.log("Attempting call 'analyzeImage'...", imageUrl);
      setIsLoading(true);
      setError("");
      setAnalysisResult(null);
      setRecommendedTracks(null);
      setFunctionResponse("👁️ Analyzing image...");

      try {
        const analyzeImageFunction = httpsCallable<
          AnalyzeImageData,
          AnalysisResult
        >(functions, "analyzeImage");
        const result = await analyzeImageFunction({imageUrl: imageUrl});
        console.log("Cloud Function Response (Analysis):", result.data);
        setAnalysisResult(result.data);
        callGetRecommendations(result.data);
      } catch (error: any) {
        console.error("Error calling 'analyzeImage':", error);
        let errorMessage = `Analysis failed: ${error.message}`;
        if (error.code) {
          errorMessage += ` (Code: ${error.code})`;
        }
        if (error.details) {
          console.error("Function error details:", error.details);
        }
        setError(errorMessage);
        setFunctionResponse("");
        setAnalysisResult(null);
        setRecommendedTracks(null);
        setIsLoading(false);
      }
    };

    // --- Upload Image & Trigger Full Flow ---
    // (handleUploadAndAnalyze remains the same)
    const handleUploadAndAnalyze = async () => {
      if (!selectedImageUri) {
        Alert.alert("No Image", "Please select or take image first.");
        return;
      }
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Not Authenticated", "Please log in.");
        return;
      }
      console.log("--- handleUploadAndAnalyze ---");
      setIsLoading(true);
      setError("");
      setAnalysisResult(null);
      setRecommendedTracks(null);
      setFunctionResponse("Starting upload...");
      setUploadProgress(0);

      try {
        const response = await fetch(selectedImageUri);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        if (blob.size === 0) throw new Error("Blob size is 0.");
        console.log("Blob OK. Size:", blob.size, "Type:", blob.type);
        const userId = currentUser.uid;
        let fileExtension = "jpg";
        if (blob.type) {
          const mp = blob.type.split("/");
          if (mp.length === 2 && mp[0] === "image") {
            switch (mp[1]) {
              case "jpeg":
                fileExtension = "jpg";
                break;
              case "png":
                fileExtension = "png";
                break;
              case "gif":
                fileExtension = "gif";
                break;
              case "webp":
                fileExtension = "webp";
                break;
              default:
                fileExtension = mp[1];
            }
          } else {
            console.warn("Bad blob type:", blob.type);
          }
        } else {
          console.warn("Blob type undef");
        }
        const uniqueFilename = `${uuidv4()}.${fileExtension}`;
        const storagePath = `images/${userId}/${uniqueFilename}`;
        if (!storage) throw new Error("Storage not init.");
        const storageRef = ref(storage, storagePath);
        console.log("Uploading to:", storagePath);
        const uploadTask = uploadBytesResumable(storageRef, blob);

        uploadTask.on(
          "state_changed",
          (s) => {
            const p = (s.bytesTransferred / s.totalBytes) * 100;
            setUploadProgress(p);
            if (
              functionResponse.startsWith("Starting") ||
              functionResponse.startsWith("Uploading")
            ) {
              setFunctionResponse(`Uploading: ${Math.round(p)}%`);
            }
          },
          (e) => {
            console.error("Upload Error:", e.code, e.message);
            let msg = `Upload failed: ${e.message}`;
            if (e.code === "storage/retry-limit-exceeded") {
              msg = `Upload fail: Connection unstable.`;
            } else if (e.code === "storage/unauthorized") {
              msg = `Upload fail: Permission denied.`;
            }
            setError(msg);
            setFunctionResponse("");
            setIsLoading(false);
            setUploadProgress(0);
            setAnalysisResult(null);
            setRecommendedTracks(null);
          },
          () => {
            console.log("Upload successful:", storagePath);
            getDownloadURL(uploadTask.snapshot.ref)
              .then((downloadURL) => {
                console.log("Download URL:", downloadURL);
                setUploadProgress(100);
                callAnalyzeFunction(downloadURL);
              })
              .catch((urlError) => {
                console.error("Get URL Error:", urlError);
                setError(`Upload OK, get URL fail: ${urlError.message}`);
                setFunctionResponse("");
                setIsLoading(false);
                setUploadProgress(0);
                setAnalysisResult(null);
                setRecommendedTracks(null);
              });
          },
        );
      } catch (e: any) {
        console.error("Upload prep error:", e);
        setError(`Error: ${e.message}`);
        setFunctionResponse("");
        setIsLoading(false);
        setUploadProgress(0);
        setAnalysisResult(null);
        setRecommendedTracks(null);
      }
    };

    // <<< --- ADDED Audio Playback Logic --- >>>
    const playPreview = async (track: RecommendedTrack) => {
      if (!track.previewUrl) {
        Alert.alert("No Preview", "No audio preview available for this track.");
        return;
      } // No preview available

      console.log(`Attempting to play: ${track.name} (${track.id})`);

      setIsPlaying(false); // Assume pause initially

      // If another track is playing or loaded, stop and unload it first
      if (playbackInstance && currentlyPlayingId !== track.id) {
        console.log(
          `Unloading previous track: ${currentlyPlayingId}`,
        );
        await playbackInstance.unloadAsync();
        setPlaybackInstance(null);
        setCurrentlyPlayingId(null); // Important: Reset before loading new one
      }

      // If THIS track is already loaded (toggle play/pause)
      if (playbackInstance && currentlyPlayingId === track.id) {
        const status = await playbackInstance.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            console.log(`Pausing track: ${track.id}`);
            await playbackInstance.pauseAsync();
            setIsPlaying(false);
          } else {
            console.log(`Resuming track: ${track.id}`);
            await playbackInstance.playAsync();
            setIsPlaying(true);
          }
        } else {
          // Should not happen if instance exists, but handle defensively
          console.log("Track instance exists but not loaded, reloading.");
          setPlaybackInstance(null); // Force reload
          setCurrentlyPlayingId(null);
          // Recursive call to retry loading (use with caution or better state mgmt)
          playPreview(track);
        }
      } else {
        // Load and play THIS track
        console.log(`Loading new track: ${track.id}`);
        try {
          await Audio.setAudioModeAsync({playsInSilentModeIOS: true});
          const {sound, status} = await Audio.Sound.createAsync(
            {uri: track.previewUrl},
            {shouldPlay: true}, // Start playing immediately
          );

          if (status.isLoaded) {
            console.log("Playback instance created and playing.");
            setPlaybackInstance(sound);
            setCurrentlyPlayingId(track.id);
            setIsPlaying(true); // It started playing

            sound.setOnPlaybackStatusUpdate((statusUpdate) => {
              if (statusUpdate.isLoaded) {
                // Update isPlaying state based on actual playback status
                setIsPlaying(statusUpdate.isPlaying);
                if (statusUpdate.didJustFinish) {
                  console.log(`Track finished naturally: ${track.id}`);
                  sound.unloadAsync(); // Unload when done
                  setPlaybackInstance(null);
                  setCurrentlyPlayingId(null);
                  // setIsPlaying is already false via statusUpdate
                }
              } else {
                // Handle potential unload or errors during playback
                if (statusUpdate.error) {
                  console.error(`Playback Error: ${statusUpdate.error}`);
                }
                // If it gets unloaded unexpectedly, reset state
                if (currentlyPlayingId === track.id) {
                   setPlaybackInstance(null);
                   setCurrentlyPlayingId(null);
                   setIsPlaying(false);
                }
              }
            });
          } else {
              throw new Error("Sound could not be loaded.");
          }
        } catch (e) {
          console.error("Error playing preview:", e);
          Alert.alert("Playback Error", "Could not play audio preview.");
          setPlaybackInstance(null); // Clean up on error
          setCurrentlyPlayingId(null);
          setIsPlaying(false);
        }
      }
    };

    // Cleanup sound instance on component unmount
    useEffect(() => {
      return () => {
        console.log("Unmounting ImageScreen, unloading sound.");
        playbackInstance?.unloadAsync();
      };
    }, [playbackInstance]); // Rerun effect if playbackInstance changes

    // <<< --- END Audio Playback Logic --- >>>

    // --- Calculate display dimensions ---
    // (Remains the same)
    const windowWidth = Dimensions.get("window").width;
    const windowHeight = Dimensions.get("window").height;
    const maxDisplayWidth = windowWidth * 0.9;
    const maxDisplayHeight = windowHeight * 0.45;
    let displayWidth: number | null = null;
    let displayHeight: number | null = null;
    if (
      selectedImageWidth &&
      selectedImageHeight &&
      selectedImageWidth > 0 &&
      selectedImageHeight > 0
    ) {
      const scaleX = maxDisplayWidth / selectedImageWidth;
      const scaleY = maxDisplayHeight / selectedImageHeight;
      const finalScale = Math.min(scaleX, scaleY);
      displayWidth = selectedImageWidth * finalScale;
      displayHeight = selectedImageHeight * finalScale;
    }

    // --- Render UI ---
    return (
      <LinearGradient
        colors={themeColors.backgroundGradient}
        style={styles.gradientWrapper}
      >
        <ScrollView // Main ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Image Analysis & Song Mood</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.pickButton,
                isLoading ? styles.buttonDisabled : {},
              ]}
              onPress={pickImage}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cameraButton,
                isLoading ? styles.buttonDisabled : {},
              ]}
              onPress={takePicture}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>Camera</Text>
            </TouchableOpacity>
          </View>

          {/* Image Display */}
          {selectedImageUri && displayWidth && displayHeight ? (
            <View
              style={[styles.imageContainer, {width: displayWidth, height: displayHeight}]}
            >
              <Image
                source={{uri: selectedImageUri}}
                style={styles.selectedImage}
                resizeMode="contain"
              />
            </View>
          ) : (
            /* Placeholder area */
            <View
              style={[
                styles.imageContainer,
                styles.imagePlaceholder,
                {width: maxDisplayWidth, height: 200},
              ]}
            >
              <Text style={styles.placeholderText}>Select or take an image</Text>
            </View>
          )}

          {/* Recommendations Button */}
          {selectedImageUri && !isLoading && !analysisResult && !recommendedTracks && ( // Show only if no results yet
            <TouchableOpacity
              style={[styles.button, styles.analyzeButton]}
              onPress={handleUploadAndAnalyze}
            >
              <Text style={styles.buttonText}>Get Recommendations</Text>
            </TouchableOpacity>
          )}

          {/* Loading / Status / Results Area */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.pink} />
              <Text style={styles.progressText}>{functionResponse}</Text>
            </View>
          )}

          {/* Spotify Recommendations Display */}
          {!isLoading && recommendedTracks && recommendedTracks.length > 0 && (
            <View style={[styles.responseContainer, styles.recommendationsBox]}>
              <Text style={styles.responseText}>Recommended Songs:</Text>
              <ScrollView
                style={styles.recommendationsScrollContainer}
                nestedScrollEnabled={true}
              >
                {recommendedTracks.map((track) => (
                  <View key={track.id} style={styles.trackItem}>
                    {/* Cover Art */}
                    {track.albumImageUrl ? (
                      <Image
                        source={{uri: track.albumImageUrl}}
                        style={styles.albumArt}
                      />
                    ) : (
                      <View style={[styles.albumArt, styles.albumArtPlaceholder]} />
                    )}
                    {/* Track Info */}
                    <View style={styles.trackInfo}>
                      <Text style={styles.trackName} numberOfLines={1}>
                        {track.name}
                      </Text>
                      <Text style={styles.trackArtist} numberOfLines={1}>
                        {track.artists.join(", ")}
                      </Text>
                    </View>
                    {/* <<< --- Play Button --- >>> */}
                    {track.previewUrl && ( // Only show if preview exists
                      <TouchableOpacity
                        onPress={() => playPreview(track)}
                        style={styles.playButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tappable area
                      >
                        <Ionicons
                          name={
                            currentlyPlayingId === track.id && isPlaying
                              ? "pause-circle" // Playing this track
                              : "play-circle" // Not playing this track (or paused)
                          }
                          size={34} // Slightly larger icon
                          color={
                             currentlyPlayingId === track.id && isPlaying
                               ? themeColors.blue // Use blue when active/playing
                               : themeColors.pink // Pink otherwise
                          }
                        />
                      </TouchableOpacity>
                    )}
                     {/* --- Add placeholder if no preview --- */}
                    {!track.previewUrl && (
                      <View style={styles.playButtonPlaceholder} />
                    )}
                    {/* <<< --- END Play Button --- >>> */}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* No songs found message */}
          {!isLoading && recommendedTracks && recommendedTracks.length === 0 && (
            <View style={[styles.responseContainer, styles.infoBox]}>
              <Text style={styles.responseText}>
                No specific song recommendations found.
              </Text>
            </View>
          )}
          {/* Error message */}
          {!isLoading && error && (
            <View style={[styles.responseContainer, styles.errorBox]}>
              <Text style={styles.errorTitle}>Error:</Text>
              <Text style={styles.errorText} selectable={true}>
                {error}
              </Text>
            </View>
          )}
          {/* Bottom padding inside ScrollView */}
          <View style={{height: 30}} />
        </ScrollView>
      </LinearGradient>
    );
  }

  // --- Styles ---
  const windowHeight = Dimensions.get("window").height;
  const styles = StyleSheet.create({
    gradientWrapper: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContentContainer: {
      alignItems: "center",
      paddingBottom: 30,
      paddingTop: 30,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      marginBottom: 25,
      color: themeColors.textLight,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      width: "90%",
      marginBottom: 20,
      alignSelf: "center",
    },
    button: {
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderRadius: 25,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      marginHorizontal: 8,
      shadowColor: "#000",
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    },
    pickButton: {backgroundColor: themeColors.pink},
    cameraButton: {backgroundColor: themeColors.blue},
    analyzeButton: {
      backgroundColor: themeColors.pink,
      width: "80%",
      marginTop: 25,
      marginBottom: 15,
      alignSelf: "center",
      flex: 0, // Prevents button from stretching
      shadowColor: "#000",
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
      boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.25)",
    },
    buttonDisabled: {opacity: 0.5},
    buttonText: {
      color: themeColors.textLight,
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    imageContainer: {
      marginVertical: 20,
      borderRadius: 15,
      overflow: "hidden",
      alignSelf: "center",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 3,
      borderColor: themeColors.pink,
    },
    imagePlaceholder: {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderWidth: 1,
      borderColor: themeColors.grey,
    },
    placeholderText: {color: themeColors.textSecondary},
    selectedImage: {width: "100%", height: "100%"},
    loadingContainer: {alignItems: "center", paddingVertical: 40},
    progressText: {
      marginTop: 15,
      fontSize: 14,
      color: themeColors.textSecondary,
      textAlign: "center",
      paddingHorizontal: 20,
    },
    responseContainer: {
      padding: 15,
      borderRadius: 10,
      width: "90%",
      borderWidth: 0,
      alignSelf: "center",
      marginVertical: 10,
      backgroundColor: themeColors.darkGrey,
    },
    errorBox: {backgroundColor: "#5c2020", borderColor: themeColors.errorRed, borderWidth: 1},
    infoBox: {backgroundColor: themeColors.darkGrey},
    recommendationsBox: {backgroundColor: themeColors.darkGrey},
    responseText: {
      fontWeight: "bold",
      marginBottom: 10,
      color: themeColors.textLight,
      fontSize: 16,
    },
    errorTitle: {
      fontWeight: "bold",
      marginBottom: 5,
      color: themeColors.errorRed,
      fontSize: 15,
    },
    errorText: {color: "#ffb0b0", fontSize: 14},
    recommendationsScrollContainer: {maxHeight: windowHeight * 0.4, width: "100%"},
    trackItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255, 255, 255, 0.1)",
    },
    albumArt: {width: 45, height: 45, borderRadius: 4, marginRight: 12},
    albumArtPlaceholder: {backgroundColor: themeColors.grey, opacity: 0.5},
    trackInfo: {flex: 1, marginRight: 10}, // Added margin to prevent overlap with button
    trackName: {
      fontSize: 15,
      fontWeight: "600",
      color: themeColors.textLight,
      marginBottom: 3,
    },
    trackArtist: {fontSize: 13, color: themeColors.textSecondary},
    // <<< --- ADDED Play Button Style --- >>>
    playButton: {
      padding: 5, // Add padding around the icon
      marginLeft: 'auto', // Push button to the right
    },
    playButtonPlaceholder: { // To maintain layout alignment when no preview
      width: 34 + 10, // Icon size + padding * 2 (approx)
      height: 34 + 10,
      marginLeft: 'auto',
    },
    // <<< --- END Play Button Style --- >>>
  });