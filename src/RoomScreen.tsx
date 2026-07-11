import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

type Theme = {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  line: string;
  accent: string;
};

type Props = {
  theme: Theme;
  onBack: () => void;
};

const ROOM_URL = 'https://web-room-mu.vercel.app';

export default function RoomScreen({ theme, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { backgroundColor: theme.bg }]}>
        <Pressable onPress={onBack} style={[styles.roundBtn, { backgroundColor: theme.surface }]}>
          <Text style={[styles.roundBtnText, { color: theme.ink }]}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.eyebrow, { color: theme.inkSoft }]}>CICADA ROOMS</Text>
          <Text style={[styles.title, { color: theme.ink }]}>Listen together</Text>
        </View>
      </View>

      <WebView
        key={reloadKey}
        source={{ uri: ROOM_URL }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['https://*']}
        mixedContentMode="compatibility"
        onLoadStart={() => {
          setLoading(true);
          setFailed(false);
        }}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onHttpError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />

      {loading ? (
        <View pointerEvents="none" style={[styles.overlay, { backgroundColor: theme.bg }]}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[styles.overlayText, { color: theme.inkSoft }]}>Loading Cicada Rooms...</Text>
        </View>
      ) : null}

      {failed ? (
        <View style={[styles.overlay, { backgroundColor: theme.bg }]}>
          <Text style={[styles.errorTitle, { color: theme.ink }]}>Room page did not load</Text>
          <Text style={[styles.overlayText, { color: theme.inkSoft }]}>
            Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => {
              setFailed(false);
              setReloadKey((value) => value + 1);
            }}
            style={[styles.retryBtn, { backgroundColor: theme.ink }]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    zIndex: 2,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnText: { fontSize: 30, lineHeight: 32, fontWeight: '600' },
  headerText: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  webview: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  overlayText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  errorTitle: { fontSize: 18, fontWeight: '800' },
  retryBtn: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
