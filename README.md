# Universal Content Downloader

A powerful, clean, and modern web application to analyze and download content from any public URL. Liberate web content into the format you need.

## 🚀 Online Test (Quick & No Installation)

Experience **Universal Downloader** directly in your browser:

- **Main Demo (Hosted on Google Cloud Run – Recommended)**:  
  [Access Demo](https://ais-pre-sfffs4jmpgdvr4fffnandh-403190054073.us-east1.run.app)  
  Full interface with download queue, ready-to-use examples, and dark mode.

- **Experimental Version on Gemini AI Studio (Fast for testing prompts)**:  
  [Test on AI Studio](https://aistudio.google.com/apps/7a68c0b4-b8ca-4585-85d6-944c41a80212?fullscreenApplet=true)  
  Paste a public URL → click Analyze.  
  *Note: You may see a "developer app" warning — it is safe, just click **Continue**. Works without login in most cases, but a free Google account might be required in some regions.*

> "In the AI Studio version, accept the 'app from another user' disclaimer to proceed — this is standard Google behavior for shared apps."

## ✨ Features
- **Analyze Any URL**: Get instant metadata, titles, and content previews.
- **Multiple Formats**:
  - **HTML Source**: Full webpage structure.
  - **Clean Markdown**: Perfect for documentation and notes.
  - **Plain Text**: Raw text content without tags.
  - **Image Conversion**: Convert web images to PNG, JPG, or WebP on the fly.
- **Download Queue**: Manage multiple downloads simultaneously.
- **File System Access**: Save files directly to your preferred local folders (supported browsers).
- **Dark Mode**: Beautiful, high-contrast theme for focused work.

## 📝 Concrete Examples

| Content Type | Example URL | Output Format |
|--------------|-------------|---------------|
| **Documentation** | `https://react.dev` | Clean Markdown (.md) |
| **News Article** | `https://bbc.com/news/...` | Plain Text (.txt) |
| **Public Image** | `https://picsum.photos/800/600` | PNG / JPG / WebP |
| **Raw Asset** | `https://example.com/file.pdf` | Original (.pdf) |

## ⚠️ Limitations & Warnings

- **Login-Protected Content**: The downloader cannot access content behind logins, paywalls, or private sessions.
- **JS-Heavy Sites**: Extremely dynamic sites (like some SPAs) may not render fully as the tool uses a server-side fetch proxy rather than a full headless browser.
- **Social Media (Video)**: Direct video extraction from Twitter/X, Instagram Reels, or YouTube is **not supported** unless a direct media URL is provided.
- **Rate Limits**: Excessive requests may be throttled by the target servers or our proxy layer.
- **Gemini Context**: While the UI is crafted for clarity, the extraction quality depends on the raw HTML structure of the target page.

## 🛠️ Technical Stack
- **Frontend**: React 19, Vite, Tailwind CSS, Framer Motion.
- **Backend**: Express (Node.js) with Axios proxy.
- **Typography**: Inter (Sans) & JetBrains Mono (Technical).
- **Icons**: Lucide React.

## 📦 Local Setup
1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:3000`.

---
*Designed for the open web. Use responsibly.*
