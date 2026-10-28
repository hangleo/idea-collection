import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';
import { eventsToScore } from './melody';
import { buildMusicXml } from './musicxml';
import type { Idea } from './types';

/**
 * Renders the idea's melody to a MusicXML file and opens the system share
 * sheet so it can be saved or sent to notation software (MuseScore, Finale…).
 * Returns false when the idea has no melody or sharing is unavailable.
 */
export async function shareMusicXml(idea: Idea): Promise<boolean> {
  if (!idea.melody || idea.melody.length === 0) return false;

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Sharing unavailable', 'MusicXML export is not supported on this device.');
    return false;
  }

  try {
    const xml = buildMusicXml(idea.title, eventsToScore(idea.melody));
    const safeName =
      idea.title
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'melody';
    const file = new File(Paths.cache, `${safeName}-${idea.id}.musicxml`);
    await file.write(xml);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.recordare.musicxml+xml',
      dialogTitle: 'Export MusicXML',
      UTI: 'com.recordare.musicxml',
    });
    return true;
  } catch {
    Alert.alert('Export failed', 'Could not create the MusicXML file.');
    return false;
  }
}
