# Upgrade the messenger to CHEESECrypt

Bring the full CHEESECrypt from CheeseHub into this app's messages window. The window keeps the same secret link (no visible button) and stays a pop-up window, now named **CHEESECrypt**.

## What you'll get

1. **Long messages.** Messages are no longer capped at one memo. A long message is split into up to 20 parts and sent in one transaction. Each part costs 0.0110 CHEESE, and the composer shows the parts and total cost before you send.
2. **Group chats (3–6 people).** Pick 2–5 friends to start a group. Each member gets their own encrypted copy. You pay one 0.0100 CHEESE fee per part plus 0.0010 CHEESE to each member. Groups can be hidden and shown again.
3. **Profiles.** An optional display name plus an 8×8 pixel avatar you paint yourself, saved inside your key file and shared with your public key. Friends you haven't named get an automatic avatar based on their account name.
4. **Friend nicknames, and removing friends.** Rename a friend for yourself only, or remove a friend.
5. **Unread badges** on each chat and group. The first time you open it, old messages count as already read.
6. **Key folder (Chrome/Edge).** Choose a `cheesecrypt` folder once (it suggests your Desktop). It holds a "my private key" folder and a "friends" folder, and your key is loaded from it automatically next time. It never overwrites a file. Other browsers keep the current Load file / Download buttons.
7. **Share key window**, guided first-time profile setup, and an "About CHEESECrypt" explainer.
8. **Works with CheeseHub.** Messages, published keys and key files use the same format, so friends on CheeseHub and here can message each other with the same key.

## Transaction memos (your choice)

- The fee transfer's memo becomes **"CHEESECrypt GPK messaging fee"**, the CheeseHub wording plus "GPK" so you can tell which app sent it.
- The message memos (the encrypted text) and the published-key memo stay exactly as they are. Changing them would break reading old messages and finding published keys on both sites.

## Kept from this app

- The unlock-first screen, the header dropdowns (Conversations / Your key) and the sender labels on every message.
- Old messages, keys and friends already saved in this browser keep working. They're copied over to CHEESECrypt automatically the first time, and nothing is deleted.
- The CheeseHub fart-sound easter egg and the terms checkbox are left out, because this app doesn't have them.

## Technical details

- Port `cheeseCrypt.ts` (multi-part split/assemble, `messageCost`), `cryptGroups.ts`, `cryptVault.ts`, `cryptUnread.ts`, `cryptNames.ts` and `cryptAvatar.ts` into `src/lib/`, replacing `chainMessaging.ts`. Point the Hyperion lookups at this app's existing endpoint fallback list instead of CheeseHub's `endpointHealth`.
- Port the `components/crypt/*` dialogs (AvatarEditor, PixelAvatar, VaultPrompt, ShareKeyDialog, CreateGroupDialog, FriendNameDialog, CryptAbout) and rebuild `ChainMessagingDialog.tsx` around CheeseHub's `Messenger`, keeping the current header-dropdown layout and the unlock gate.
- Storage: the new keys use the `cheesecrypt-*` names. On first load, `gpk-msg-key-*` and `gpk-msg-contacts-*` are copied across without touching the originals.
- Transactions go through the existing wallet executor as one atomic transaction (recipient payments + nulled fee); groups pay the fee once per part.
- Tests: port CheeseHub's crypt test suites (parts, groups, vault, unread, names, avatar, profile setup), add tests for the GPK fee memo, the storage migration and the cost of a multi-part group message, then run the full suite.
- Update `AGENTS.md` (the messaging rule), memory (the chain-messaging fee memo and name) and `roadmap.md`.
