# Dev Blog: User-Uploaded MIDI Editing Integration

**Date**: 2026-04-01
**Author**: Antigravity Engineering Team

## Overview

A major step towards a fully user-centric rhythm game ecosystem, we have now integrated the **Rhythm Editor** with our **Local Song Storage** system. This allows players not only to play their own MIDI files but also to use our professional-grade editing tools to fine-tune the gameplay experience for their custom content.

## Technical Implementation

### 1. Unified Storage Access (IndexedDB)
The Rhythm Editor (`EditorGame.ts`) now bridges the gap between static assets and user-generated content. By integrating `LocalSongStorage`, the editor's initialization phase now performs a dual-source fetch:
- **Official Assets**: Loads from the pre-defined `midi_list.json`.
- **User Assets**: Dynamically queries the IndexedDB `songs` store for any custom tracks.

### 2. The `user://` Protocol Handler
To ensure seamless integration without modifying the core `MidiParser` or `CoreAudioEngine`, we implemented a virtual protocol handler:
```typescript
if (name.startsWith('user://')) {
    const blobKey = name.replace('user://', '');
    const blob = await this.storage.getSongBlob(blobKey);
    buffer = await blob.arrayBuffer();
}
```
This allows the editor to handle IndexedDB references as if they were standard URLs, maintaining a clean abstraction layer.

### 3. Smart Configuration Mapping
Every custom song has a unique ID in our storage. The editor uses this ID to generate specific `localStorage` keys for beatmap configurations (measure assignments, channel roles, etc.). This means that any adjustments you make to a custom song's difficulty or channel mapping are preserved across sessions.

## Impact & Quality Assurance

- **Stability**: The integration uses a non-destructive approach, ensuring that official songs and existing folder-upload workflows remain fast and reliable.
- **Performance**: Querying IndexedDB is performant even with hundreds of custom songs, thanks to our optimized metadata caching.
- **UX**: The `[USER]` prefix in the song selector provides immediate visual feedback, making it easy to manage a growing library of custom content.

## Future Plans
We are currently evaluating the possibility of adding a "Export MIDI" feature to allow users to share their modified MIDI files directly from the editor.

---
*Stay tuned for more updates as we continue to push the boundaries of rhythm game engineering!*
