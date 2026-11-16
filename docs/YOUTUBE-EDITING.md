# Applying approved changes to YouTube

Creator Desk's optimization feed can propose and edit local title, description and tag drafts without YouTube editing permission. A deliberate **Enable approved YouTube updates** action starts a separate Google authorization flow.

**Warning:** Google's `youtube.force-ssl` permission is powerful; it can also allow changes and deletion of videos, comments and captions. This implementation uses it only for the user-initiated video metadata update operation. Refusing this permission leaves read-only recommendations available.

For each video, open its editable draft, edit the fields you want, and **check Approve title change, Approve description change, and/or Approve tags change individually**. All are unchecked by default. Unchecked fields are preserved exactly, even if their draft text has been edited. Select **Review selected changes** to freeze the chosen values and inspect only those exact before/after differences, then explicitly choose **Confirm and update this YouTube video**. No edits run on app launch. Creator Desk checks owner-channel identity, validates field limits, re-reads current metadata, preserves category/language and sends exactly one `videos.update?part=snippet` request. After the request, it re-reads YouTube and shows success only if the selected values match.

**If YouTube has changed the metadata since the initial recommendation:** Creator Desk stops and requests a fresh review. **If the update is uncertain or readback fails:** check YouTube directly before trying again. No automatic retry will happen.

Each confirmed change stores a database-backed, append-only summary of the exact approved field names, full before values and full after values under unique keys. Backups include these records; Google tokens remain in the encrypted credential vault and are not embedded in reports or backups.

This feature requires real-owner acceptance testing and four passing desktop CI jobs before release. Automated tests use synthetic Google API responses and do not change a real YouTube video.

Official reference: https://developers.google.com/youtube/data/reference/rest/v3/videos/update

Known limits: no automatic field-wide bulk edits; no silent posting; no guarantee of additional reach; thumbnails cannot be changed through the `videos.update` snippet request. Google's public OAuth consent/verification requirements may apply to general distribution.
