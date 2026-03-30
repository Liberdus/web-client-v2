# Liberdus Web Client v2 - Issue Tracker

**Repository:** Liberdus/web-client-v2  
**Last Updated:** March 30, 2026

---

## Open Issues

| # | Title | Status | Branch | Notes |
|---|-------|--------|--------|-------|
| 1200 | Username found but can't continue | ⬜ Not Started | | |
| 1199 | Copy paste image into chat | ✅ Completed | image_attachment | PR #1201 |
| 1198 | Spinning icon during backup | 🔄 In Progress | backup_spinner_and_toast | |
| 989 | Notification shows, but no message seen [10 hours] | ⬜ Not Started | | |

---

## Issue Details

### Issue #1200: Username found but can't continue
- **Status:** ⬜ Not Started
- **Branch:** 
- **Created:** March 30, 2026
- **Description:** On the New Chat modal if you enter 0xhayder for the username, it is found, but the Continue button gives an error about invalid Ethereum address format. If the username is found we should not be testing for an Ethereum address.

---

### Issue #1199: Copy paste image into chat
- **Status:** ✅ Completed
- **Branch:** 
- **Created:** March 25, 2026
- **Completed:** March 30, 2026
- **Description:** Feature to paste an image that was copied to the clipboard directly into the chat field. Saves the user from having to save the image and upload it into the chat field. Suggested by Osman Ali.
- **Implementation:** Added paste event listener on message input for clipboard images (PC and mobile) and drag/drop event listeners on messages container for image files (PC only). Both reuse the existing `handleFileAttachment` function.

---

### Issue #1198: Spinning icon during backup
- **Status:** 🔄 In Progress
- **Branch:** backup_spinner_and_toast
- **Created:** March 17, 2026
- **Updated:** March 30, 2026
- **Description:** During the backup process it can take some time to complete; especially when backing up to Google drive and uploading the data. When the backup begins the user is shown a toast saying "Backing up to Google Drive", but the toast goes away after a few seconds and causes the user to think that the backup is done. After some time the user sees a message that the backup has completed. If the user should not do other things while the backup is in progress, we should show a spinning icon during the backup. If it is ok for the user to be interacting with the app during the backup process, then this issue can be closed without any change.
- **Implementation:** Added `isUploading` state tracking to BackupAccountModal. Shows persistent loading toast with spinner during Google Drive upload. Prevents modal close, sign out, and page navigation during upload with appropriate warning messages.

---

### Issue #989: Notification shows, but no message seen [10 hours]
- **Status:** ⬜ Not Started
- **Branch:** 
- **Created:** December 11, 2025
- **Bounty:** 10 hours of credit (not open to team members)
- **Description:** On mobile devices the app shows a notification, and if there are multiple accounts the bell indicates which account the notification is for. But after signing into that account there are no new messages or payments seen. If the user clears the cache for the app and signs in, all the missed messages are suddenly received. This does not happen consistently and rarely happens, but it has been seen on Android and iOS. Since it will not be easy to test if your solution fixes this, you will need to explain what the problem is and why your solution will fix it.

---

## Status Legend
- ⬜ Not Started
- 🔄 In Progress
- ✅ Completed
- ❌ Blocked
- ⏭️ Skipped/Closed

---

## Progress Summary
- **Total Issues:** 4
- **Completed:** 0
- **In Progress:** 0
- **Remaining:** 4
