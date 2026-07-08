// Global variables
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const serverUrlInput = document.getElementById('server-url');
const serverPortInput = document.getElementById('server-port');
const connectButton = document.getElementById('connect-button');
const connectionStatus = document.getElementById('connection-status');
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

let isConnected = false;
let currentModel = '';
let pendingImage = null;

// Chat management: each chat has an id, name, and messages array.
let chats = [];
let currentChat = null;
const serverUrl = serverUrlInput.value.trim();
const serverPort = serverPortInput.value.trim();
const endPoint = serverPort ? `http://${serverUrl}:${serverPort}` : serverUrl;
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
function addMessage(content, isUser, metrics = null, store = true) {
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
  contentDiv.innerHTML = marked.parse(content);
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

  if (typeof MathJax !== 'undefined') {
    MathJax.typesetPromise([messageDiv]).catch(err => console.error('MathJax typeset failed:', err));
  }

  attachCopyButtons(messageDiv);

  if (store && currentChat) {
    currentChat.messages.push({ content, isUser, metrics, isImage: false });
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
  const newChat = { id: chatId, name: `Conversation ${chats.length + 1}`, messages: [] };
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
    addMessage(message.content, message.isUser, message.metrics, false);
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
  if (currentModel && currentModel !== newModel) {
    modelSelect.disabled = true;
    await ejectCurrentModel(currentModel);
  }
  currentModel = newModel;
  modelSelect.disabled = false;
});

// Connect to server and populate model dropdown.
async function connectToServer() {
  // const serverUrl = serverUrlInput.value.trim();
  // const serverPort = serverPortInput.value.trim();
  // const endPoint = serverPort ? `http://${serverUrl}:${serverPort}` : serverUrl;
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
    updateConnectionStatus('Conectando...', false);
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
      updateConnectionStatus('Conectado', true);
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
    updateConnectionStatus('Fallo al conectar', false);
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
  chatContainer.scrollTop = chatContainer.scrollHeight;

  userInput.value = '';
  userInput.disabled = true;
  sendButton.disabled = true;

  // const serverUrl = serverUrlInput.value.trim();
  const startTime = performance.now();
  let accumulatedText = '';

  try {
    const response = await fetch(`${endPoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentModel,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: -1,
        stream: true
      })
    });
    if (!response.ok) throw new Error('Server response was not ok');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
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
              const delta = parsed.choices[0].delta;
              if (delta && delta.content) {
                accumulatedText += delta.content;
                assistantContentDiv.innerHTML = marked.parse(accumulatedText);
                assistantMessageElement.querySelectorAll('pre code').forEach(block => {
                  hljs.highlightElement(block);
                });
                attachCopyButtons(assistantMessageElement);
                if (typeof MathJax !== 'undefined') {
                  MathJax.typesetPromise([assistantMessageElement]).catch(err => console.error(err));
                }
                // Scroll to bottom after each content update
                chatContainer.scrollTop = chatContainer.scrollHeight;
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
    const endTime = performance.now();
    const timeElapsed = ((endTime - startTime) / 1000).toFixed(2);
    if (currentChat) {
      // Store the assistant message into the chat history
      currentChat.messages.push({ content: accumulatedText, isUser: false, isImage: false });
      saveChatsIfNotEmpty();
      if (currentChat.name.startsWith('Conversation')) {
        const snippet = accumulatedText.split(' ').slice(0, 7).join(' ');
        currentChat.name = snippet ? `Conversation: ${snippet}...` : currentChat.name;
        updateChatList();
      }
    }
  } catch (error) {
    console.error('Error:', error);
    addMessage('Error: Unable to get a response from the server. Please try again.', false);
    isConnected = false;
    updateConnectionStatus('Disconnected', false);
  } finally {
    userInput.disabled = false;
    sendButton.disabled = false;
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
    addMessage('Disconnected from LM Studio server', false);
    currentModel = '';
    modelSelect.disabled = true;
  } else {
    connectToServer();
  }
});

userInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
sendButton.addEventListener('click', sendMessage);
newChatButton.addEventListener('click', () => { createNewChat(); });
toggleSidebarButton.addEventListener('click', () => { chatSidebar.classList.toggle('collapsed'); });

// Load saved chats when the page loads
loadSavedChats().then(() => {
  serverUrlInput.focus();
});