⚠️ This is an **unofficial** project and is **not affiliated with or endorsed by LM Studio**.

# LM Studio Chat WebUI (unofficial)

A browser-based chat interface for interacting with your LM Studio server. Connect to your locally hosted LM Studio model and chat with it from any device with a web browser, including mobile phones. The app uses no backend — all communication is direct between your browser and the LM Studio server. 

## Features

- Dark mode interface with purple theme
- Connect to any LM Studio server (custom address and port)
- Chat with your LM Studio model
- LaTeX math rendering via MathJax
- Markdown rendering with syntax-highlighted code blocks (Highlight.js)
- Mobile-friendly design
- Multiple chat sessions with IndexedDB persistence
- Vision model support with image upload
- Model selection dropdown
- Export chats as HTML or Markdown
- Debug console via `?debug` URL parameter (Eruda)
- GitHub Pages deployment for zero-setup usage (https://isaaacd.github.io/LMStudioWebUI/)


## Screenshots 📸
![image](https://github.com/user-attachments/assets/7944a30a-6e52-467b-bf27-309f8db0bfde)
![image](https://github.com/user-attachments/assets/cecc2e50-1583-4ce6-a092-10adcb2359f3)
![image](https://github.com/user-attachments/assets/717bb8c6-ff62-4574-95e4-146909302180)
![image](https://github.com/user-attachments/assets/22275a46-f332-4ab9-b727-678a98aef7af)
![image](https://github.com/user-attachments/assets/d7cba468-166b-4d74-a98a-37ca72093b83)




## Project Structure

```
├── index.html          # Main entry point
├── styles.css          # Stylesheet
├── libs/               # JavaScript and library files
│   ├── app.js          # Core application logic
│   ├── cabecera.js     # Header functionality
│   ├── cuerpo.js       # Body functionality
│   ├── indexeddb.js    # IndexedDB chat persistence
│   ├── eruda.js        # Mobile debug console
│   ├── marked.min.js   # Markdown rendering
│   ├── highlight.min.js # Code syntax highlighting
│   └── mathjax-*       # LaTeX math rendering
└── .github/workflows/  # GitHub Pages deployment
```

## Setup Instructions

### Option 1: Use the hosted version (Recommended)
Open the GitHub Pages deployment in your browser. No setup required.

### Option 2: Self-host locally

1. Clone or download this repository.
2. Serve the entire directory using any static file server. The files must be served together — `index.html` references external CSS and JS files.

**Quick start with Python:**
```bash
cd LMStudioWebUI
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

**Quick start with Node.js:**
```bash
npx serve LMStudioWebUI
```

### For Mobile Users
This works out of the box on Android devices. For iOS you need to open the page in Microsoft Edge or another browser. Safari/Chrome do not work when opening local files directly. The easiest approach is to use the hosted GitHub Pages version or self-host on a local server accessible from your mobile device.

## Usage Instructions

1. **Start LM Studio Server**:
   - Open LM Studio on your computer.
   - Go to the "Server" tab (In 0.3.x -> Developer -> Local Server).
   - Ensure that CORS is enabled and Serve on Local Network is enabled.
   - Click "Start Server" and note down the server address.

2. **Connect to LM Studio Server**:
   - In the chat interface, enter the LM Studio server address and port in the input fields at the top.
   - Click the "Connect" button.

3. **Start Chatting**:
   - Once connected, select a model from the dropdown.
   - Type messages in the input field at the bottom of the screen.
   - Press Enter or tap Send to send your message.
   - The model's responses will appear in the chat window.

4. **Debug Mode** (Optional):
   - Append `?debug` to the URL to enable the Eruda mobile debug console.

## Troubleshooting

- **Can't connect to server**:
  - Ensure LM Studio Server is running on your computer.
  - Check that you're using the correct server address and port.
  - If accessing from another device, make sure both devices are on the same network.

- **Slow responses**:
  - LM Studio processing speed depends on your computer's capabilities. Larger models may take longer to respond.

- **Interface not loading or missing styles/scripts**:
  - Make sure you're serving the entire directory, not just `index.html`. The HTML file references external CSS and JS files in `styles.css` and `libs/`.
  - Do not open `index.html` directly via `file://` — use a local web server (`http://`).
  - Try opening the page with a different web browser.

## Security Note

This interface is designed for local use only. Do not expose your LM Studio server to the public internet without proper security measures in place. All communication happens directly between your browser and the LM Studio server — no data is sent to third-party servers.

## Feedback and Contributions

See [contributing.md](contributing.md) for details. 

