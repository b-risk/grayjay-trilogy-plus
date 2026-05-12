## Notice

> **The plugin treats every series as it's own channel, but there are some videos on the platform that are uncategorized and they don't provide a good endpoint to list them, so the uncategorized videos are put under a channel called "Trilogy Plus" and it grabs a few of the most recent uncategorized releases so you can still follow them. You can also click on the playlists tab to view all the non-series playlists.**

### Grayjay Trilogy Plus
This plugin adds support for the streaming service Trilogy Plus, allowing you to use it in Grayjay.

### Installation
You can install the plugin by scanning this QR code:  
![QR Code](https://raw.githubusercontent.com/b-risk/grayjay-trilogy-plus/refs/heads/main/qr-code.png)

Alternatively, you can add it manually by using this link:
```
grayjay://plugin/https://raw.githubusercontent.com/b-risk/grayjay-trilogy-plus/refs/heads/main/TrilogyPlusConfig.json
```

### Features
- [x] Video playback & metadata
- [x] Free videos support
- [x] Homepage results, defaults to free videos and alternative home feeds in plugin settings
- [x] Support series as individual channels
- [x] Video searches
- [x] Channel (series) support
- [x] Channel searches
- [x] Uncategorized videos & playlists feed as channel (see the [notice](#notice))
- [x] Alternative video formats, defaults to HLS (Progressive MP4, etc)
- [x] Generate miscellaneous comment avatars using the [UI Avatars API](https://ui-avatars.com/) 
- [x] Playlists search & support (non-series collections)
- [x] Comments support
- [x] Comment replies support
- [x] Import "My List" as playlist
- [ ] Sign plugin


### Contributions
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.

### Credits
Special thanks to Stefan Cruz for his help during the development of the plugin.

### Signing
```bash
# Generate keypair
ssh-keygen -t rsa -b 2048 -m PEM -f ./private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./private-key.pem)"

# Run the sign script:
sh ./sign-script.sh "{SCRIPT_FILE_PATH}" "{CONFIG_FILE_PATH}"
```