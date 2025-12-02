import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Database, 
  Settings, 
  Send, 
  Plus, 
  Trash2, 
  Save, 
  Cpu, 
  ShieldCheck, 
  Terminal,
  X,
  Loader2,
  Search,
  BookOpen
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  setDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';

// --- Firebase Configuration ---
// In a real Vercel app, these would be process.env.REACT_APP_FIREBASE_...
// The system injects these variables in this specific environment.
const getFirebaseConfig = () => {
  try {
    // @ts-ignore
    return JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
  } catch (e) {
    return {};
  }
};

const app = initializeApp(getFirebaseConfig());
const auth = getAuth(app);
const db = getFirestore(app);
// @ts-ignore
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app';

// --- Types ---
type View = 'chat' | 'admin';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[]; // Simple keyword indexing for 0-budget search
}

interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
}

// --- Helper: Simple Keyword Extraction ---
const extractKeywords = (text: string): string[] => {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3) // Filter out small words
    .filter((v, i, a) => a.indexOf(v) === i); // Unique
};

// --- Main Component ---
export default function CryptoKnowledgeBank() {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<View>('chat');
  const [apiKey, setApiKey] = useState('');
  
  // Data State
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'ai', content: 'Greetings. I am the Oracle for The Swarm Board. Ask me anything about the project, roadmap, or tokenomics.', timestamp: Date.now() }
  ]);
  
  // UI State
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [loginError, setLoginError] = useState(false);
  
  // Admin Form State
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemContent, setNewItemContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. Auth & Data Init ---
  useEffect(() => {
    const initAuth = async () => {
      // @ts-ignore
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        // @ts-ignore
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- 2. Fetch Knowledge Base & Config ---
  useEffect(() => {
    if (!user) return;

    // A. Fetch Knowledge Base
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'));
    const unsubscribeKB = onSnapshot(q, (snapshot) => {
      const items: KnowledgeItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as KnowledgeItem);
      });
      setKnowledgeBase(items);
    }, (error) => {
      console.error("Error fetching knowledge:", error);
    });

    // B. Fetch Global Config (API Key)
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
    const unsubscribeConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      }
    });

    return () => {
      unsubscribeKB();
      unsubscribeConfig();
    };
  }, [user]);

  // --- 3. Scroll to bottom of chat ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Actions ---

  const handleSaveSettings = async () => {
    if (!user) return;
    try {
      // Save key to the shared database
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), {
        apiKey: apiKey
      }, { merge: true });
      
      alert("Configuration saved to database. All users will now use this key.");
    } catch (e) {
      console.error("Error saving config:", e);
      alert("Error saving configuration.");
    }
  };

  const handleAdminLogin = () => {
    if (adminPasswordInput === '.m4nt1ss4') {
      setIsAdminUnlocked(true);
      setLoginError(false);
      setAdminPasswordInput('');
    } else {
      setLoginError(true);
    }
  };

  const handleAddItem = async () => {
    if (!newItemTitle || !newItemContent) return;
    if (!user) return;

    try {
      const keywords = extractKeywords(newItemTitle + ' ' + newItemContent + ' ' + newItemCategory);
      
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'knowledge'), {
        title: newItemTitle,
        category: newItemCategory,
        content: newItemContent,
        keywords: keywords,
        createdAt: serverTimestamp()
      });

      setNewItemTitle('');
      setNewItemContent('');
      // Notification or UI feedback could go here
    } catch (e) {
      console.error("Error adding item:", e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'knowledge', id));
    } catch (e) {
      console.error("Error deleting item:", e);
    }
  };

  // --- The Brain (AI Logic) ---
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // 1. Add User Message
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Client-side RAG (Retrieval)
      // We score knowledge items based on keyword overlap with the user query
      const queryKeywords = extractKeywords(userMsg.content);
      
      const scoredItems = knowledgeBase.map(item => {
        let score = 0;
        // Boost for title match
        if (item.title.toLowerCase().includes(userMsg.content.toLowerCase())) score += 10;
        
        // Keyword overlap
        queryKeywords.forEach(qKey => {
          if (item.keywords && item.keywords.includes(qKey)) score += 2;
          if (item.content.toLowerCase().includes(qKey)) score += 1;
        });
        
        return { item, score };
      });

      // Filter and Sort by relevance
      const relevantContext = scoredItems
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5) // Take top 5 chunks
        .map(x => `[Source: ${x.item.title}]\n${x.item.content}`)
        .join('\n\n');

      // 3. Construct Prompt
      const systemPrompt = `
        You are the official AI Assistant for a crypto project. 
        Your goal is to answer user questions ACCURATELY based ONLY on the provided context.
        
        Tone: Professional, slightly futuristic, helpful, and concise.
        
        If the answer is not in the context, strictly state: "I currently do not have that specific data in my knowledge bank."
        Do not hallucinate facts.
        
        CONTEXT FROM KNOWLEDGE BANK:
        ${relevantContext || "No specific database matches found."}
      `;

      if (!apiKey) {
        throw new Error("System Offline: API Key not configured by Admin.");
      }

      // 4. Call Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `System Instruction: ${systemPrompt}\n\nUser Question: ${userMsg.content}` }]
          }]
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Communication error with neural net.";

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: aiText,
        timestamp: Date.now()
      }]);

    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Renderers ---

  const renderSidebar = () => (
    <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-[300px] md:h-full">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <Cpu className="text-emerald-400" />
        <span className="font-bold text-slate-100 tracking-wider">THE SWARM BOARD</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button 
          onClick={() => setView('chat')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'chat' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <MessageSquare size={18} />
          <span>Interface</span>
        </button>
        
        <button 
          onClick={() => setView('admin')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${view === 'admin' ? 'bg-purple-500/10 text-purple-400' : 'text-slate-400 hover:bg-slate-800'}`}
        >
          <ShieldCheck size={18} />
          <span>Admin Panel</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        v1.1.0 | SECURE: ACTIVE
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 z-10 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded bg-emerald-900/50 flex items-center justify-center border border-emerald-500/30 shrink-0">
                <Cpu size={16} className="text-emerald-400" />
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-lg p-4 leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white' 
                : msg.role === 'system'
                ? 'bg-red-900/20 text-red-400 border border-red-500/30'
                : 'bg-slate-900 text-slate-300 border border-slate-800'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'ai' && (
                <div className="mt-2 text-[10px] text-emerald-500/50 flex items-center gap-1 uppercase tracking-widest">
                  <ShieldCheck size={10} /> Verified Output
                </div>
              )}
            </div>

            {msg.role === 'user' && (
               <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
               <div className="w-2 h-2 rounded-full bg-slate-400" />
             </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
             <div className="w-8 h-8 rounded bg-emerald-900/50 flex items-center justify-center border border-emerald-500/30">
                <Loader2 size={16} className="text-emerald-400 animate-spin" />
              </div>
              <div className="text-slate-500 text-sm flex items-center animate-pulse">
                Processing neural request...
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 z-20">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Query the protocol..."
            className="flex-1 bg-slate-950 border border-slate-800 text-slate-200 px-4 py-3 rounded-md focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-slate-600"
          />
          <button 
            onClick={handleSendMessage}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => {
    if (!isAdminUnlocked) {
      return (
        <div className="flex-1 h-full bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <ShieldCheck size={32} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Restricted Access</h2>
              <p className="text-slate-400 mt-2">Enter administration credentials to proceed.</p>
            </div>
            <div className="space-y-4">
              <input 
                type="password" 
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Password"
                className={`w-full bg-slate-950 border p-3 rounded text-slate-200 focus:outline-none transition-colors ${loginError ? 'border-red-500' : 'border-slate-700 focus:border-emerald-500'}`}
              />
              {loginError && <p className="text-red-400 text-sm">Access Denied: Invalid credentials.</p>}
              <button 
                onClick={handleAdminLogin}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded transition-colors font-medium"
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 h-full bg-slate-950 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                <ShieldCheck className="text-purple-400" />
                Admin Panel
              </h2>
              <p className="text-slate-400 mt-1">System Configuration & Knowledge Management</p>
            </div>
            <button 
              onClick={() => setIsAdminUnlocked(false)}
              className="text-xs text-slate-500 hover:text-slate-300 border border-slate-800 px-3 py-1 rounded"
            >
              LOCK TERMINAL
            </button>
          </div>

          {/* Section 1: API Configuration */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
              <Settings size={18} className="text-blue-400" />
              API Configuration
            </h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold">Gemini API Key</label>
                <div className="relative">
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded pl-10 text-slate-200 focus:border-blue-500 outline-none"
                  />
                  <Terminal size={16} className="absolute left-3 top-3.5 text-slate-600" />
                </div>
              </div>
              <button 
                onClick={handleSaveSettings}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded transition-colors h-[50px]"
              >
                Save Key
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
               Key is stored in the database. All users will use this key automatically.
            </p>
          </div>

          {/* Section 2: Knowledge Base */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
              <Database size={18} className="text-emerald-400" />
              Knowledge Base Management
            </h3>

            {/* Add New */}
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Ingest New Data</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input 
                  placeholder="Title (e.g. Tokenomics)" 
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="bg-slate-950 border border-slate-700 p-3 rounded text-slate-200 focus:border-emerald-500 outline-none"
                />
                 <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="bg-slate-950 border border-slate-700 p-3 rounded text-slate-200 focus:border-emerald-500 outline-none"
                >
                  <option value="General">General</option>
                  <option value="Roadmap">Roadmap</option>
                  <option value="Team">Team</option>
                  <option value="Technical">Technical</option>
                </select>
              </div>
              <textarea 
                placeholder="Paste content here..." 
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                className="w-full h-32 bg-slate-950 border border-slate-700 p-3 rounded text-slate-200 focus:border-emerald-500 outline-none resize-none font-mono text-sm"
              />
              <div className="flex justify-end">
                <button 
                  onClick={handleAddItem}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  <Save size={16} /> Save Record
                </button>
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Existing Records ({knowledgeBase.length})</h4>
              {knowledgeBase.length === 0 ? (
                <div className="text-center py-12 text-slate-600 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                  Database is empty. Add data above.
                </div>
              ) : (
                <div className="grid gap-3">
                  {knowledgeBase.map(item => (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg group hover:border-slate-700 transition-all flex justify-between items-start">
                      <div className="flex-1 mr-4">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase border border-slate-700">{item.category}</span>
                          <h4 className="font-medium text-slate-200 text-sm">{item.title}</h4>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-1 font-mono">{item.content.substring(0, 100)}...</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {renderSidebar()}
      {view === 'chat' ? renderChat() : renderAdmin()}
    </div>
  );
}
