import yaySfx from '@/assets/pack-reveal-complete.mp3';

// The yay clip is played by exactly one moment: the final card flipping over in
// the pack reveal window (see usePackRevealAudio). It was originally played at
// full volume and was too loud, so the reveal uses this halved value — import
// it rather than hardcoding so the clip stays tuned in one place.
//
// The collection deal animation deliberately has no celebration sound of its
// own: the user asked for the end-of-deal yay to be removed, so do not re-add
// a playPackYay()-style helper here without asking first.
export const YAY_VOLUME = 0.5;

export const YAY_SFX = yaySfx;
