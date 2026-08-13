// Global variables
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const serverUrlInput = document.getElementById('server-url');
const serverPortInput = document.getElementById('server-port');
const connectButton = document.getElementById('connect-button');
const connectionStatus = document.getElementById('status-text');
const sendButton = document.getElementById('send-button');
const newChatButton = document.getElementById('new-chat-button');
const toggleSidebarButton = document.getElementById('toggle-sidebar');
const chatSidebar = document.getElementById('chat-sidebar');
const chatList = document.getElementById('chat-list');
const contextMenu = document.getElementById('context-menu');
const modelSelect = document.getElementById('model-select');
const uploadButton = document.getElementById('upload-button');
const imageUpload = document.getElementById('image-upload');
const imagePreview = document.getElementById('image-preview');
const toggleHeaderButton = document.getElementById('toggle-header');
const downloadHTMLButton = document.getElementById('download-html-button');
const downloadMDButton = document.getElementById('download-md-button');

let isConnected = false;
let currentModel = '';
let pendingImage = null;

// Chat management: each chat has an id, name, and messages array.
let chats = [];
let currentChat = null;

// Load saved chats on startup
async function loadSavedChats() {
  try {
    const savedChats = await window.indexedDBHelper.loadChatsFromIndexedDB();
    if (savedChats && savedChats.length > 0) {
      chats = savedChats;
      currentChat = chats[0];
      updateChatList();
      loadChat(currentChat);
    } else {
      createNewChat();
    }
  } catch (error) {
    console.error('Error loading saved chats:', error);
    createNewChat();
  }
}

// Save chats to IndexedDB, but only if they have messages
function saveChatsIfNotEmpty() {
  const hasMessages = chats.some(chat => chat.messages.length > 0);
  if (hasMessages) {
    window.indexedDBHelper.saveChatsToIndexedDB(chats);
  }
}

// Helper: Attach copy buttons to code blocks and assistant messages
function attachCopyButtons(container) {

  container.querySelectorAll('pre').forEach(pre => {
    if (!pre.querySelector('.copy-btn')) {
      pre.style.position = 'relative';
      const button = document.createElement('button');
      button.className = 'copy-btn';
      button.innerHTML = '<i class="fas fa-copy"></i> Copy';
      button.addEventListener('click', () => {
        const codeText = pre.querySelector('code').innerText;
        navigator.clipboard.writeText(codeText)
          .then(() => {
            button.innerText = "Copied!";
            setTimeout(() => {
              button.innerHTML = '<i class="fas fa-copy"></i> Copy';
            }, 2000);
          })
          .catch(err => {
            console.error('Failed to copy code: ', err);
          });
      });
      pre.appendChild(button);
    }
  });

  // Add copy button for assistant messages
  const assistantMessages = container.parentElement.querySelectorAll('.assistant-message');
  assistantMessages.forEach(msg => {
    if (!msg.querySelector('.message-copy-btn')) {
      msg.style.position = 'relative';
      const copyBtn = document.createElement('button');
      copyBtn.className = 'message-copy-btn';
      copyBtn.innerHTML = '📋';
      copyBtn.title = 'Copy message text';
      copyBtn.style.position = 'absolute';
      copyBtn.style.top = '5px';
      copyBtn.style.right = '5px';
      copyBtn.style.backgroundColor = 'var(--accent-color)';
      copyBtn.style.color = 'var(--text-color)';
      copyBtn.style.border = 'none';
      copyBtn.style.borderRadius = '4px';
      copyBtn.style.cursor = 'pointer';
      copyBtn.style.fontSize = '0.85rem';
      copyBtn.style.padding = '3px 7px';
      copyBtn.style.opacity = '0.8';
      copyBtn.style.transition = 'opacity 0.2s';
      copyBtn.style.zIndex = '10';

      copyBtn.addEventListener('click', () => {
        const contentDiv = msg.querySelector('.message-content');
        if (contentDiv) {
          // Get text content, excluding code blocks
          let textContent = '';
          const walker = document.createTreeWalker(
            contentDiv,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          let node;
          while (node = walker.nextNode()) {
            if (!node.parentElement.closest('code, pre')) {
              textContent += node.textContent + ' ';
            }
          }

          navigator.clipboard.writeText(textContent.trim())
            .then(() => {
              copyBtn.innerHTML = '✓';
              setTimeout(() => {
                copyBtn.innerHTML = '📋';
              }, 2000);
            })
            .catch(err => {
              console.error('Failed to copy text: ', err);
            });
        }
      });

      msg.appendChild(copyBtn);
    }
  });
}

// Adds a message to the DOM and (optionally) stores it.
// If store is false, the message is only displayed and not added to currentChat.messages.
function addMessage(content, isUser, metrics = null, store = true, reasoning = null) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', isUser ? 'user-message' : 'assistant-message');

  const headerDiv = document.createElement('div');
  headerDiv.classList.add('message-header');
  headerDiv.textContent = isUser ? 'You' : 'Assistant';
  messageDiv.appendChild(headerDiv);

  if (!isUser && currentModel) {
    const modelDiv = document.createElement('div');
    modelDiv.classList.add('message-model');
    modelDiv.textContent = currentModel;
    messageDiv.appendChild(modelDiv);
  }

  const contentDiv = document.createElement('div');
  contentDiv.classList.add('message-content');
  let html = '';
  if (reasoning) {
    html += `<details class="reasoning-details"><summary class="reasoning-toggle">Reasoning</summary><div class="reasoning-content">${marked.parse(reasoning)}</div></details>`;
  }
  html += marked.parse(content);
  contentDiv.innerHTML = html;
  messageDiv.appendChild(contentDiv);

  if (metrics) {
    const metricsDiv = document.createElement('div');
    metricsDiv.classList.add('message-metrics');
    metricsDiv.textContent = metrics;
    messageDiv.appendChild(metricsDiv);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  messageDiv.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });

  if (typeof MathJax !== 'undefined' && typeof MathJax.typesetPromise === 'function') {
    MathJax.typesetPromise([messageDiv]).catch(err => console.error('MathJax typeset failed:', err));
  }

  attachCopyButtons(messageDiv);

  if (store && currentChat) {
    currentChat.messages.push({ content, isUser, metrics, isImage: false, reasoning });
    saveChatsIfNotEmpty();
  }
}

// Adds an image message.
function addImageMessage(dataURL, promptText) {
  // Display image message in the UI
  addMessage(`<img src="${dataURL}" style="max-width:100%; border-radius: var(--border-radius);" />`, true);
  // Mark the last message in the history as an image message
  const lastMsg = currentChat.messages[currentChat.messages.length - 1];
  lastMsg.isImage = true;
  lastMsg.imageData = dataURL;
  lastMsg.text = promptText;
  saveChatsIfNotEmpty();
}

// Creates a new chat.
function createNewChat() {
  const chatId = Date.now();
  const newChat = { id: chatId, name: `Chat ${chats.length + 1}`, messages: [] };
  chats.push(newChat);
  currentChat = newChat;
  updateChatList();
  chatContainer.innerHTML = '';
}

// Renders the chat list in the sidebar.
function updateChatList() {
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const li = document.createElement('li');
    li.textContent = chat.name;
    li.dataset.chatId = chat.id;
    if (currentChat && chat.id === currentChat.id) li.classList.add('active');
    li.addEventListener('click', () => {
      if (currentChat && chat.id === currentChat.id) return;
      currentChat = chat;
      loadChat(chat);
      updateChatList();
    });
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.pageX, e.pageY, chat.id);
    });
    chatList.appendChild(li);
  });
}

// Loads a chat's messages into the chat container.
function loadChat(chat) {
  chatContainer.innerHTML = '';
  chat.messages.forEach(message => {
    // When loading, we display messages without storing them again.
    addMessage(message.content, message.isUser, message.metrics, false, message.reasoning || null);
  });
}

// Custom context menu for deleting chats.
function showContextMenu(x, y, chatId) {
  contextMenu.style.left = x + "px";
  contextMenu.style.top = y + "px";
  contextMenu.style.display = "block";
  contextMenu.onclick = () => {
    deleteChat(chatId);
    hideContextMenu();
  };
}
function hideContextMenu() { contextMenu.style.display = "none"; }
document.addEventListener('click', () => { if (contextMenu.style.display === "block") hideContextMenu(); });
function deleteChat(chatId) {
  chats = chats.filter(c => c.id != chatId);
  if (currentChat && currentChat.id == chatId) {
    currentChat = chats.length > 0 ? chats[0] : null;
    if (!currentChat) createNewChat();
    else loadChat(currentChat);
  }
  updateChatList();
  saveChatsIfNotEmpty();
}

// Ejects the currently loaded model.
async function ejectCurrentModel(oldModel) {
  const serverUrl = serverUrlInput.value.trim();
  const serverPort = serverPortInput.value.trim();
  const endPoint = serverPort ? `http://${serverUrl}:${serverPort}` : serverUrl;

  try {
    await fetch(`${endPoint}/v1/model/eject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: oldModel })
    });
    console.log(`Model ${oldModel} ejected.`);
  } catch (error) {
    console.error("Error ejecting model:", error);
  }
}

// Build conversation history without merging messages.
// The history starts with the system prompt, then includes each stored message in order.
function buildConversationHistory() {
  const systemPrompt = currentChat.messages.some(msg => msg.isImage)
    ? "You are an AI assistant that analyzes images."
    : "You are an intelligent assistant. You always provide well-reasoned answers that are both correct and helpful.";
  const history = [{ role: 'system', content: systemPrompt }];
  currentChat.messages.forEach(msg => {
    if (msg.isImage) {
      history.push({
        role: msg.isUser ? 'user' : 'assistant',
        content: [
          { type: "text", text: msg.text || "What's in this image?" },
          { type: "image_url", image_url: { url: msg.imageData } }
        ]
      });
    } else {
      history.push({ role: msg.isUser ? 'user' : 'assistant', content: msg.content });
    }
  });
  return history;
}

// Model selection change: eject old model if needed.
modelSelect.addEventListener('change', async (e) => {
  const newModel = e.target.value;
  const oldModel = currentModel;
  if (currentModel && currentModel !== newModel) {
    modelSelect.disabled = true;
    await ejectCurrentModel(currentModel);
  }
  currentModel = newModel;
  modelSelect.disabled = false;
  addMessage(`Unloaded ${oldModel} and loading ${newModel}`, false, null, false);
});

// Connect to server and populate model dropdown.
async function connectToServer() {
  const serverUrl = serverUrlInput.value.trim();
  const serverPort = serverPortInput.value.trim();
  const endPoint = serverPort ? `http://${serverUrl}:${serverPort}` : serverUrl;

  console.log('endpoint:', endPoint);
  if (!serverUrl) {
    updateConnectionStatus('Please enter a valid address', false);
    return;
  }
  console.log('endPoint:', endPoint, 'ok');
  if (!/^http:\/\/[a-zA-Z0-9.-]+:[0-9]+$/.test(endPoint)) {
    updateConnectionStatus('Invalid address. Use http://host:port', false);
    return;
  }
  try {
    updateConnectionStatus('Connecting...', false);
    const fetchUrl = `${endPoint}/v1/models`;
    console.log('fetching:', fetchUrl);
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error('La respuesta no fue válida');
    const data = await response.json();
    if (data && data.data && data.data.length > 0) {
      modelSelect.innerHTML = "";
      data.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        modelSelect.appendChild(option);
      });
      modelSelect.disabled = false;
      currentModel = modelSelect.value;
      isConnected = true;
      updateConnectionStatus('Connected', true);
      userInput.disabled = false;
      sendButton.disabled = false;
      if (!currentChat) createNewChat();
      // Display connection message without storing it in the chat history
      addMessage('Connected to LM Studio server. You can start chatting', false, null, false);
    } else {
      throw new Error('No models available');
    }
  } catch (error) {
    console.error('Error:', error);
    updateConnectionStatus('Failed to connect', false);
    addMessage('Error: Unable to connect to LM Studio server. Check the address and try again.', false);
  }
}

function updateConnectionStatus(message, connected) {
  connectionStatus.textContent = message;
  connectionStatus.style.color = connected ? 'var(--accent-color)' : '#f44336';
  connectButton.textContent = connected ? 'Disconnect' : 'Connect';
  serverUrlInput.disabled = connected;
  userInput.disabled = !connected;
  sendButton.disabled = !connected;
}

// Send message: if a pending image exists, include it.
async function sendMessage() {
  if (!isConnected) return;
  let message = userInput.value.trim();
  if (!message && !pendingImage) return;

  if (pendingImage) {
    let promptText = message || "What's in this image?";
    addImageMessage(pendingImage, promptText);
    pendingImage = null;
    imagePreview.style.display = "none";
    userInput.value = "";
  } else {
    addMessage(message, true);
  }

  const conversationHistory = buildConversationHistory();

  // Create a temporary assistant message element for streaming response
  const assistantMessageElement = document.createElement('div');
  assistantMessageElement.classList.add('message', 'assistant-message');

  const headerDiv = document.createElement('div');
  headerDiv.classList.add('message-header');
  headerDiv.textContent = 'Assistant';
  assistantMessageElement.appendChild(headerDiv);

  if (currentModel) {
    const modelDiv = document.createElement('div');
    modelDiv.classList.add('message-model');
    modelDiv.textContent = currentModel;
    assistantMessageElement.appendChild(modelDiv);
  }

  const assistantContentDiv = document.createElement('div');
  assistantContentDiv.classList.add('message-content');
  assistantMessageElement.appendChild(assistantContentDiv);

  chatContainer.appendChild(assistantMessageElement);

  userInput.value = '';
  userInput.disabled = true;
  //sendButton.disabled = true;
  sendButton.innerHTML = '<i class="fa-solid fa-stop"></i>';
  sendButton.classList.add('stop-button');

  // const serverUrl = serverUrlInput.value.trim();
  const startTime = performance.now();
  let accumulatedReasoning = '';
  let accumulatedText = '';

  // Track if user has scrolled up during the response
  let isUserScrolledUp = false;
  let previousScrollTop = chatContainer.scrollTop;
  let isAtBottom = true;

  const serverUrl = serverUrlInput.value.trim();
  const serverPort = serverPortInput.value.trim();
  const endPoint = serverPort ? `http://${serverUrl}:${serverPort}` : serverUrl;

  try {
    abortController = new AbortController();
    const response = await fetch(`${endPoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentModel,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: -1,
        stream: true
      }),
      signal: abortController.signal
    });
    if (!response.ok) throw new Error('Server response was not ok');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let renderPending = false;

    // Add scroll event listener to track user scrolling
    const handleScroll = () => {
      if (chatContainer.scrollHeight - chatContainer.clientHeight < chatContainer.scrollTop + 100) {
        isAtBottom = true;
      } else {
        isAtBottom = false;
      }
    };

    chatContainer.addEventListener('scroll', handleScroll);

    // Create persistent container elements — only update the one that changed
    const reasoningDetails = document.createElement('details');
    reasoningDetails.className = 'reasoning-details';
    reasoningDetails.setAttribute('open', '');
    const reasoningSummary = document.createElement('summary');
    reasoningSummary.className = 'reasoning-toggle';
    reasoningSummary.textContent = 'Reasoning';
    const reasoningContentDiv = document.createElement('div');
    reasoningContentDiv.className = 'reasoning-content';
    reasoningDetails.appendChild(reasoningSummary);
    reasoningDetails.appendChild(reasoningContentDiv);
    const responseContentDiv = document.createElement('div');
    responseContentDiv.className = 'response-content';

    const updateSection = (section, text) => {
      section.innerHTML = marked.parse(text);
      section.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
      attachCopyButtons(assistantMessageElement);
    };

    let mathJaxTimer = null;
    const scheduleMathJax = () => {
      if (typeof MathJax === 'undefined' || typeof MathJax.typesetPromise !== 'function') return;
      if (mathJaxTimer) clearTimeout(mathJaxTimer);
      mathJaxTimer = setTimeout(() => {
        MathJax.typesetPromise([assistantMessageElement]).catch(err => console.error(err));
        mathJaxTimer = null;
      }, 300);
    };

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith("data:")) {
            const dataStr = line.slice(5).trim();
            if (dataStr === "[DONE]") { done = true; break; }
            try {
              const parsed = JSON.parse(dataStr);
              const delta = parsed.choices[0]?.delta;
              if (delta && delta.reasoning_content) {
                accumulatedReasoning += delta.reasoning_content;
                if (!reasoningDetails.parentNode) assistantContentDiv.appendChild(reasoningDetails);
                updateSection(reasoningContentDiv, accumulatedReasoning);
                scheduleMathJax();
                if (isAtBottom) chatContainer.scrollTop = chatContainer.scrollHeight;
              }
              if (delta && delta.content) {
                accumulatedText += delta.content;
                if (!responseContentDiv.parentNode) assistantContentDiv.appendChild(responseContentDiv);
                updateSection(responseContentDiv, accumulatedText);
                scheduleMathJax();
                if (isAtBottom) chatContainer.scrollTop = chatContainer.scrollHeight;
              }

            } catch (err) {
              console.error("Error parsing stream chunk", err);
            }
          } else if (line.startsWith("event:")) {
            const eventType = line.slice(6).trim();
            if (eventType === "error") {
              console.error("Received error event from server:", line);
              addMessage("Error: Received error event from server", false);
              done = true;
              break;
            }
          }
        }
      }
    }

    // Final MathJax render after streaming ends
    if (mathJaxTimer) clearTimeout(mathJaxTimer);
    if (typeof MathJax !== 'undefined' && typeof MathJax.typesetPromise === 'function') {
      MathJax.typesetPromise([assistantMessageElement]).catch(err => console.error(err));
    }

    // Remove scroll event listener when done
    chatContainer.removeEventListener('scroll', handleScroll);
    const endTime = performance.now();
    const timeElapsed = ((endTime - startTime) / 1000).toFixed(2);
    if (currentChat) {
      // Store the assistant message into the chat history
      currentChat.messages.push({ content: accumulatedText, isUser: false, isImage: false, reasoning: accumulatedReasoning || null });
      saveChatsIfNotEmpty();
      if (currentChat.name.startsWith('Chat')) {
        const snippet = accumulatedText.split(' ').slice(0, 7).join(' ');
        currentChat.name = snippet ? `${snippet}...` : currentChat.name;
        updateChatList();
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (assistantMessageElement.parentNode) {
      assistantMessageElement.parentNode.removeChild(assistantMessageElement);
    }
    addMessage('Error: Unable to get a response from the server. Please try again.', false);
    isConnected = false;
    updateConnectionStatus('Disconnected', false);
  } finally {
    userInput.disabled = false;
    sendButton.disabled = false;
    sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
    sendButton.classList.remove('stop-button');
    abortController = null;
    userInput.focus();
  }
}

// Image upload: store image and show preview.
uploadButton.addEventListener('click', () => { imageUpload.click(); });
imageUpload.addEventListener('change', () => {
  const file = imageUpload.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    pendingImage = e.target.result;
    imagePreview.innerHTML = `<img src="${pendingImage}" style="max-width:100%; border-radius: var(--border-radius);" />`;
    imagePreview.style.display = "block";
  };
  reader.readAsDataURL(file);
  imageUpload.value = "";
});

connectButton.addEventListener('click', () => {
  if (isConnected) {
    isConnected = false;
    updateConnectionStatus('Disconnected', false);
    userInput.disabled = true;
    sendButton.disabled = true;

    currentModel = '';
    modelSelect.disabled = true;
  } else {
    connectToServer();
  }
});

let abortController = null;

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
sendButton.addEventListener('click', () => {
  let isStop = sendButton.classList.contains('stop-button');
  console.log("Is Stop", isStop);
  if (isStop) {
    // Stop the current response
    if (abortController) {
      abortController.abort();
    }
  } else {
    // Send a new message
    sendMessage();
  }
});
newChatButton.addEventListener('click', () => { createNewChat(); });
toggleSidebarButton.addEventListener('click', () => {
  if (window.innerWidth <= 480) {
    chatSidebar.classList.toggle('mobile-open');
  } else {
    chatSidebar.classList.toggle('collapsed');
  }
});

// Close mobile sidebar when clicking the overlay backdrop
chatSidebar.addEventListener('click', (e) => {
  if (window.innerWidth <= 480 && e.target === chatSidebar) {
    chatSidebar.classList.remove('mobile-open');
  }
});

// Toggle header collapse
toggleHeaderButton.addEventListener('click', () => {
  const container = document.getElementById('server-url-container');
  container.classList.toggle('collapsed');
  const icon = toggleHeaderButton.querySelector('i');
  if (container.classList.contains('collapsed')) {
    icon.classList.remove('fa-chevron-up');
    icon.classList.add('fa-chevron-down');
  } else {
    icon.classList.remove('fa-chevron-down');
    icon.classList.add('fa-chevron-up');
  }
});

// Download the current chat as a self-contained HTML file
function downloadChatAsHTML() {
  if (!currentChat || currentChat.messages.length === 0) {
    alert('No conversation to download.');
    return;
  }

  const messagesHTML = currentChat.messages.map(msg => {
    const role = msg.isUser ? 'You' : 'Assistant';
    const cls = msg.isUser ? 'user-message' : 'assistant-message';

    let contentHTML = '';
    if (msg.isImage && msg.imageData) {
      contentHTML = `<img src="${msg.imageData}" style="max-width:100%; border-radius:8px;" />`;
      if (msg.text) contentHTML += `<p>${msg.text}</p>`;
    } else {
      contentHTML = marked.parse(msg.content || '');
    }

    let reasoningHTML = '';
    if (msg.reasoning) {
      reasoningHTML = `<details class="reasoning-details" open><summary class="reasoning-toggle">Reasoning</summary><div class="reasoning-content">${marked.parse(msg.reasoning)}</div></details>`;
    }

    return `<div class="message ${cls}">
      <div class="message-header">${role}</div>${currentModel ? `<div class="message-model">${currentModel}</div>` : ''}
      <div class="message-content">${reasoningHTML}${contentHTML}</div>
    </div>`;
  }).join('\n    ');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${currentChat.name}</title>
<style>
:root{--background-color:#000;--text-color:#fff;--input-background:#2d2d2d;--user-message-color:#2b5278;--assistant-message-color:#2d2d2d;--button-color:#8e44ad;--accent-color:green;--border-radius:8px;--shadow:0 2px 8px rgba(0,0,0,0.3)}
*{box-sizing:border-box}
body,html{font-family:'Inter',sans-serif;margin:0;padding:0;background:var(--background-color);color:var(--text-color)}
#chat-container{max-width:800px;margin:0 auto;padding:1rem;display:flex;flex-direction:column;gap:0.75rem}
.message{max-width:85%;padding:0.75rem 1rem;border-radius:var(--border-radius);word-wrap:break-word;font-size:0.95rem;line-height:1.5;background:var(--assistant-message-color);box-shadow:var(--shadow)}
.user-message{align-self:flex-end;background:var(--user-message-color)}
.assistant-message{align-self:flex-start;background:var(--assistant-message-color)}
.message-header{font-weight:600;margin-bottom:0.35rem;font-size:0.85rem}
.message-model{font-size:0.75rem;color:#ccc;margin-bottom:0.35rem}
.message-content{margin-bottom:0.5rem}
.message-content h1,.message-content h2,.message-content h3,.message-content h4,.message-content h5,.message-content h6{margin:0.5rem 0;font-weight:600}
.message-content p{margin:0.5rem 0;line-height:1.6}
.message-content code{background:rgba(27,31,35,0.15);padding:0.2em 0.4em;border-radius:4px;font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace}
.message-content pre{background:#282c34;color:#abb2bf;padding:0.8rem;overflow-x:auto;border-radius:6px;margin:0.5rem 0}
.message-content blockquote{border-left:4px solid var(--button-color);margin:1rem 0;padding:0.5rem 1rem;color:#ccc;background:rgba(142,68,173,0.1)}
.message-content ul,.message-content ol{margin:0.5rem 0;padding-left:1.5rem}
.message-content a{color:var(--accent-color)}
.message-content table{border-collapse:collapse;margin:0.5rem 0}
.message-content th,.message-content td{border:1px solid #555;padding:0.4rem 0.6rem}
.message-content img{max-width:100%;border-radius:8px}
.reasoning-content{color:#888;font-style:italic;border:1px dashed;padding:0.5em}
.reasoning-toggle{cursor:pointer;color:#888;font-style:italic;font-size:0.9rem;padding:4px 8px;border-radius:4px;background:rgba(136,136,136,0.1)}
.reasoning-details{margin-bottom:0.5rem}
@media(max-width:600px){.message{max-width:95%;font-size:0.9rem}}
</style>
</head>
<body>
<div id="chat-container">
    ${messagesHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentChat.name.replace(/[^a-z0-9]/gi, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Download the current chat as a Markdown file
function downloadChatAsMarkdown() {
  if (!currentChat || currentChat.messages.length === 0) {
    alert('No conversation to download.');
    return;
  }

  const lines = [`# ${currentChat.name}`, ''];

  currentChat.messages.forEach(msg => {
    const role = msg.isUser ? '**You**' : '**Assistant**';
    lines.push(`---`);
    lines.push(`${role}`);
    if (currentModel) lines.push(`*Model: ${currentModel}*`);

    if (msg.reasoning) {
      lines.push('');
      lines.push(`<details><summary>Reasoning</summary>`);
      lines.push('');
      lines.push(msg.reasoning);
      lines.push('');
      lines.push(`</details>`);
    }

    if (msg.isImage) {
      if (msg.text) lines.push(msg.text);
      lines.push(`![image](${msg.imageData})`);
    } else {
      lines.push(msg.content || '');
    }
    lines.push('');
  });

  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentChat.name.replace(/[^a-z0-9]/gi, '_')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

downloadHTMLButton.addEventListener('click', () => { downloadChatAsHTML(); });
downloadMDButton.addEventListener('click', () => { downloadChatAsMarkdown(); });

// Load saved chats when the page loads
loadSavedChats().then(() => {
  serverUrlInput.focus();
});