# Chrome packaging and distribution

The primary live-test artifact is a ZIP containing the exact unpacked extension directory. Chrome's documented local development flow is `chrome://extensions` → Developer mode → **Load unpacked**.

Cautious Review also emits a real CRX3 container and cryptographically verifies its embedded ZIP. It is deliberately labeled `-preview.crx` because GitHub Actions is not the Chrome Web Store and therefore cannot make that file Web Store trusted merely by naming or signing it.

Chrome documentation states that Linux is the platform where users can install extensions hosted outside the Chrome Web Store. Standard Windows/macOS Chrome users should use the unpacked ZIP for development/live testing unless an organization supplies an approved enterprise/Web Store distribution path.

References:
- https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked
- https://developer.chrome.com/docs/extensions/how-to/distribute/host-on-linux

The release's BUILD.json records the ZIP hash, CRX hash, extension ID, and whether the CRX used an ephemeral preview key or a provided signing key. Private signing keys are never written to release artifacts.
