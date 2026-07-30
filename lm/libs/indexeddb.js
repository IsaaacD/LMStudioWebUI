// IndexedDB helper functions for chat persistence
const DB_NAME = 'LMStudioChatDB';
const STORE_NAME = 'chats';
let db;

// Open or create the database
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

// Save all chats to IndexedDB
async function saveChatsToIndexedDB(chats) {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing data
    store.clear();
    
    // Add all chats
    chats.forEach(chat => {
      store.put(chat);
    });
    
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = (event) => reject(event.target.error);
    });
  } catch (error) {
    console.error('Error saving chats:', error);
  }
}

// Load chats from IndexedDB
async function loadChatsFromIndexedDB() {
  try {
    const database = await openDatabase();
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    console.error('Error loading chats:', error);
    return [];
  }
}

// Export functions for use in app.js
window.indexedDBHelper = {
  saveChatsToIndexedDB,
  loadChatsFromIndexedDB
};
