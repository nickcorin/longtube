<div align="center">
  <img src="assets/icon128.png" alt="LongTube Logo" width="128" height="128">
  
  # LongTube - YouTube without Shorts.

</div>

<div align="center">
  
  ![Extension Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
  ![License](https://img.shields.io/badge/license-MIT-green.svg)
  ![Chrome Web Store](https://img.shields.io/badge/chrome-extension-yellow.svg)
  
  **Your brain deserves better than 10-second dopamine hits.**
  
</div>

## 🎯 Why LongTube?

Short-form content is engineered to be addictive. It hijacks your attention span, fragments your focus, and leaves you scrolling endlessly through meaningless content. **LongTube helps you take back control, and reclaim your attention.**

## ✨ Features

- **🧼 UI Cleansing** - Removes all evidence of Shorts from YouTube.
- **🔄 Redirects** - Redirects you if you accidentally open one.
- **📊 Stats** - Tracks how many Shorts blocked.
- **🔓 Open Source** - Built for myself. It's free and always will be.

## 🚀 Installation

I haven't submitted this to any of the web stores yet, but you can run it locally.

1. Clone this repository:

   ```bash
   git clone https://github.com/nickcorin/longtube.git
   cd longtube
   ```

2. Build the extension:
   ```bash
   bun run build
   ```

### Chromium-based Browsers (Chrome, Edge, Brave, Arc, Opera):

3. Open the extensions page: `<browser>://extensions/`.
4. Enable "Developer mode" (usually a toggle in the top right corner).
5. Click "Load unpacked" and select the `build/chrome/` folder.

### Gecko-based Browsers (Firefox, Zen):

3. Open the debugging page: `about:debugging#/runtime/this-firefox`
4. Click "Load Temporary Add-on"
5. Navigate to `build/firefox/` and select the `manifest.json` file

**Note:** Extensions loaded this way are temporary and will be removed when the browser restarts. This is a limitation
imposed by Firefox until the extension is signed by Mozilla.

## 🧘 Philosophy

I semi vibe-coded this for myself because I was sick of having YouTube force Shorts down my throat. It actually works
really well, and I thought it might help others too.

Feel free to use it, share it, contribute, or do anything else with it.

---

<div align="center">
  
  **Take back your attention. Your future self will thank you.**
  
  Built for humans who choose intention over algorithm.
  
</div>
