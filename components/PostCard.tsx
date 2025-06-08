// app/components/PostCard.tsx (Full Code with Aspect Ratio Image Display)

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themeColors } from '../styles/theme'; // Adjust path if your theme is elsewhere
import { Menu, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';

// Default placeholder images - ADJUST PATHS AS NEEDED
const DEFAULT_AVATAR = require('../assets/images/icon.png');
const DEFAULT_ALBUM_ART = require('../assets/images/icon.png');

export interface Post {
  id: string;
  userId: string;
  username: string;
  userProfileImageUrl: string | null;
  imageUrl: string;
  imageWidth?: number;   // Original width of the uploaded image
  imageHeight?: number;  // Original height of the uploaded image
  caption: string | null;
  song: {
    id: string;
    name: string;
    artists: string[];
    albumImageUrl: string | null;
    previewUrl: string | null;
  } | null;
  createdAt: any; // Firestore Timestamp
  likesCount?: number;
  likedBy?: string[];
  commentsCount?: number;
}

export interface PostCardProps {
  post: Post;
  currentUserId?: string | null;
  onPressPost?: (postId: string) => void;
  onPressUsername?: (userId: string) => void;
  onPressLike?: (postId: string, isLiked: boolean) => void;
  onPressComment?: (postId: string) => void;
  onPressShare?: (postId: string) => void;
  onToggleMute?: (postId: string, songUrl: string | null) => void;
  isCurrentlyPlayingAudio?: boolean;
  isMuted?: boolean;
  showMenu?: boolean;
  onDeletePost?: (postId: string) => void;
  onHidePost?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onPressPost,
  onPressUsername,
  onPressLike,
  onPressComment,
  onPressShare,
  onToggleMute,
  isCurrentlyPlayingAudio,
  isMuted,
  showMenu,
  onDeletePost,
  onHidePost
}) => {

  const [isLikedByCurrentUser, setIsLikedByCurrentUser] = React.useState(
    !!(post.likedBy && currentUserId && post.likedBy.includes(currentUserId))
  );

  React.useEffect(() => {
    setIsLikedByCurrentUser(!!(post.likedBy && currentUserId && post.likedBy.includes(currentUserId)));
  }, [post.likedBy, currentUserId]);


  const handleLikePress = () => {
    const newLikedStatus = !isLikedByCurrentUser;
    setIsLikedByCurrentUser(newLikedStatus); // Optimistic UI update
    if (onPressLike) {
      onPressLike(post.id, newLikedStatus);
    }
  };

  // --- PostCard Header ---
  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        style={styles.avatarContainer}
        onPress={() => onPressUsername && onPressUsername(post.userId)}
      >
        <Image
          source={post.userProfileImageUrl ? { uri: post.userProfileImageUrl } : DEFAULT_AVATAR}
          style={styles.avatar}
        />
      </TouchableOpacity>
      <View style={styles.usernameTimestampContainer}>
        <TouchableOpacity onPress={() => onPressUsername && onPressUsername(post.userId)}>
          <Text style={styles.usernameText}>{post.username || 'User'}</Text>
        </TouchableOpacity>
        {/* TODO: <Text style={styles.timestampText}>{formatTimestamp(post.createdAt)}</Text> */}
      </View>
      {showMenu && post.userId === currentUserId && (
        <Menu style={styles.postCardMenuTrigger}>
          <MenuTrigger>
            <Ionicons name="ellipsis-horizontal" size={24} color={themeColors.textSecondary} />
          </MenuTrigger>
          <MenuOptions customStyles={menuOptionsStylesCard}>
            {onHidePost && (
              <MenuOption onSelect={() => onHidePost(post.id)} style={styles.menuOptionCard}>
                <Text style={styles.menuOptionTextCard}>Hide</Text>
              </MenuOption>
            )}
            {onDeletePost && (
              <>
                {onHidePost && <View style={styles.menuSeparatorCard} />}
                <MenuOption onSelect={() => onDeletePost(post.id)} style={styles.menuOptionCard}>
                  <Text style={[styles.menuOptionTextCard, styles.deleteOptionTextCard]}>Delete</Text>
                </MenuOption>
              </>
            )}
          </MenuOptions>
        </Menu>
      )}
    </View>
  );

  // --- Main Image ---
  const renderImage = () => {
    const screenWidth = Dimensions.get('window').width;
    let displayImageWidth = screenWidth; // Image will try to take full screen width
    let displayImageHeight: number;

    if (post.imageWidth && post.imageHeight && post.imageWidth > 0 && post.imageHeight > 0) {
      const originalAspectRatio = post.imageHeight / post.imageWidth;
      displayImageHeight = displayImageWidth * originalAspectRatio;

      // Optional: Maximum height constraint (e.g., 70% of screen height)
      const maxAllowedImageHeight = Dimensions.get('window').height * 0.70;

      if (displayImageHeight > maxAllowedImageHeight) {
        displayImageHeight = maxAllowedImageHeight;
        // If height is capped, recalculate width to maintain aspect ratio
        displayImageWidth = displayImageHeight / originalAspectRatio;
      }
    } else {
      // Fallback if original dimensions are not available in Firestore for this post
      // Default to a common aspect ratio, e.g., 4:5 portrait or 1:1 square
      console.warn(`Post ${post.id} is missing image dimensions in Firestore. Using fallback aspect ratio 4:5.`);
      displayImageHeight = displayImageWidth * (5 / 4); // Portrait 4:5
      // For square: displayImageHeight = displayImageWidth;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPressPost && onPressPost(post.id)}
      >
        <Image
          source={{ uri: post.imageUrl }}
          style={{
            width: displayImageWidth,
            height: displayImageHeight,
            alignSelf: 'center', // Center if width is less than screen width (due to max height constraint)
          }}
          resizeMode="cover" // 'cover' works well when aspect ratio is maintained by width/height
        />
      </TouchableOpacity>
    );
  };


  // --- Action Bar ---
  const renderActionBar = () => (
    <View style={styles.actionBarContainer}>
      <View style={styles.actionIconsLeft}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
          <Ionicons name={isLikedByCurrentUser ? "heart" : "heart-outline"} size={28} color={isLikedByCurrentUser ? themeColors.pink : themeColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onPressComment && onPressComment(post.id)}>
          <Ionicons name="chatbubble-outline" size={28} color={themeColors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => onPressShare && onPressShare(post.id)}>
          <Ionicons name="paper-plane-outline" size={28} color={themeColors.textSecondary} />
        </TouchableOpacity>
      </View>
      {/* Optional Bookmark Icon
      <TouchableOpacity style={styles.actionButton}>
        <Ionicons name="bookmark-outline" size={28} color={themeColors.textSecondary} />
      </TouchableOpacity>
      */}
    </View>
  );

  // --- Likes, Caption ---
  const renderPostDetails = () => (
    <View style={styles.detailsContainer}>
      {post.likesCount !== undefined && post.likesCount > 0 && (
        <Text style={styles.likesText}>{post.likesCount === 1 ? '1 like' : `${post.likesCount} likes`}</Text>
      )}
      {post.caption && (
        <View style={styles.captionWrapper}>
          <Text style={styles.captionText} numberOfLines={2}>
            <Text style={styles.usernameInCaption} onPress={() => onPressUsername && onPressUsername(post.userId)}>
              {post.username}{" "}
            </Text>
            {post.caption}
          </Text>
        </View>
      )}
      {/* TODO: "View all X comments" link */}
      {/* TODO: Formatted timestamp */}
    </View>
  );

  // --- Song Info ---
  const renderSongInfo = () => (
    post.song && (
        <View style={styles.songInfoContainer}>
            <Image source={post.song.albumImageUrl ? {uri: post.song.albumImageUrl} : DEFAULT_ALBUM_ART} style={styles.songAlbumArt} />
            <View style={styles.songTextInfo}>
                <Text style={styles.songName} numberOfLines={1}>{post.song.name}</Text>
                <Text style={styles.songArtists} numberOfLines={1}>{post.song.artists.join(', ')}</Text>
            </View>
            {post.song.previewUrl && onToggleMute && (
                <TouchableOpacity onPress={() => onToggleMute(post.id, post.song!.previewUrl)} style={styles.muteButton}>
                    <Ionicons
                        name={isCurrentlyPlayingAudio && !isMuted ? "volume-high-outline" : (isMuted ? "volume-mute-outline" : "play-circle-outline")}
                        size={26}
                        color={themeColors.textSecondary}
                    />
                </TouchableOpacity>
            )}
        </View>
    )
  );

  return (
    <View style={styles.cardContainer}>
      {renderHeader()}
      {renderImage()}
      {renderSongInfo()}
      {renderActionBar()}
      {renderPostDetails()}
    </View>
  );
};

// Styles for Popup Menu WITHIN PostCard
const menuOptionsStylesCard = {
  optionsContainer: {
    backgroundColor: themeColors.darkGrey, paddingVertical: 0, borderRadius: 8,
    marginTop: 30, width: 120,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5,
  },
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: themeColors.darkGrey,
    // width: Dimensions.get('window').width, // The parent FlatList item wrapper should handle width
  },
  headerContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, },
  avatarContainer: { marginRight: 10, },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: themeColors.grey },
  usernameTimestampContainer: { flex: 1, },
  usernameText: { color: themeColors.textLight, fontWeight: 'bold', fontSize: 14, },
  timestampText: { color: themeColors.textSecondary, fontSize: 12, },
  postCardMenuTrigger: { marginLeft: 'auto', padding: 5, },
  menuOptionCard: { paddingVertical: 10, paddingHorizontal: 12, },
  menuOptionTextCard: { fontSize: 15, color: themeColors.textLight, },
  deleteOptionTextCard: { color: themeColors.errorRed, },
  menuSeparatorCard: { height: StyleSheet.hairlineWidth, backgroundColor: themeColors.grey, },

  // No fixed styles for postImage here; it's dynamic in renderImage()

  songInfoContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.2)', },
  songAlbumArt: { width: 30, height: 30, borderRadius: 3, marginRight: 8, backgroundColor: themeColors.grey },
  songTextInfo: { flex: 1, },
  songName: { color: themeColors.textLight, fontSize: 13, fontWeight: '500', },
  songArtists: { color: themeColors.textSecondary, fontSize: 12, },
  muteButton: { padding: 5, },
  actionBarContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, },
  actionIconsLeft: { flexDirection: 'row', alignItems: 'center', },
  actionButton: { paddingHorizontal: 8, },
  detailsContainer: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 5 },
  likesText: { color: themeColors.textLight, fontWeight: 'bold', fontSize: 14, marginBottom: 5, },
  captionWrapper: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  usernameInCaption: { color: themeColors.textLight, fontWeight: 'bold', fontSize: 14, marginRight: 5, },
  captionText: { color: themeColors.textLight, fontSize: 14, lineHeight: 19, },
  viewCommentsText: { color: themeColors.textSecondary, fontSize: 14, marginTop: 5, },
  postImagePlaceholder: { // For when Image.getSize is loading (if you use that option)
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.darkGrey,
    width: '100%', // Or Dimensions.get('window').width
    // height: Dimensions.get('window').width * 0.75, // Example placeholder height
  }
});

export default PostCard;