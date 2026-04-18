## Notice

> The plugin treats every show as it's own channel, but currently you are not able to follow videos that aren't from a series (you can still watch them and get them in your home feed) because the site does not give a backend for listing uncategorized videos, I'm not sure how to approach listing these so you are able to follow them, the only workaround is enabling email notifications for new uploads in these cases. If anyone has suggestions or workarounds feel free to leave them.

### Grayjay Trilogy Plus
This plugin adds support for the streaming service Trilogy Plus, allowing you to use it in Grayjay.

### Installation
You can install the plugin by scanning this QR code:
![QR Code](https://raw.githubusercontent.com/b-risk/grayjay-trilogy-plus/refs/heads/main/qr-code.png)

Alternatively, you can add it manually by using this link:
```
grayjay://plugin/https://raw.githubusercontent.com/b-risk/grayjay-trilogy-plus/refs/heads/main/TrilogyPlusConfig.json
```

### TODO
- [x] Homepage results
- [x] Video playback & metadata
- [x] Support series as individual channels
- [ ] Platform comments
- [ ] Video searches
- [ ] Alternative video formats, defaults to HLS (Progressive MP4, etc)
- [ ] Alternative home pages (Popular, my list, etc)
- [ ] Uncategorized video feeds (see the [notice](#notice))
- [ ] Fix bug requiring you to relogin sometimes


### Contributions
Contributions are welcome, feel free to submit pull requests if you think you can improve something or fix a bug.

### Credits
Special thanks to Stefan Cruz for his help with the development of the plugin.

### Signing
```bash
# Generate keypair
ssh-keygen -t rsa -b 2048 -m PEM -f ./private-key.pem

# Encode it in Base64 and set the environment variable
export SIGNING_PRIVATE_KEY="$(base64 -w 0 ./private-key.pem)"

# Run the sign script:
sh ./sign-script.sh "{SCRIPT_FILE_PATH}" "{CONFIG_FILE_PATH}"
```