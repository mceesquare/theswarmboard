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
  Loader2,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';

import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  serverTimestamp,
  setDoc 
} from 'firebase/firestore';
import { 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';

// Import the database connection from the config file
import { db, auth } from './firebaseConfig';

// --- CONFIGURATION ---
const PROJECT_LOGO = "/Logo.png";

// --- Types ---
type View = 'chat' | 'admin';

interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
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
    .filter(w => w.length > 3)
    .filter((v, i, a) => a.indexOf(v) === i);
};

// --- Main Component ---
export default function CryptoKnowledgeBank() {
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string>('');
  const [view, setView] = useState<View>('chat');
  const [apiKey, setApiKey] = useState('');
  
  // Data State
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  
  // --- PERSISTENCE LOGIC ---
  // Initialize messages from Local Storage if available
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('swarm_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    // Default welcome message if no history found
    return [{ id: 'welcome', role: 'ai', content: 'Greetings. I am the Swarm Leader of The Swarm Board. What\'d you like to know?.', timestamp: Date.now() }];
  });

  // Save messages to Local Storage whenever they change
  useEffect(() => {
    localStorage.setItem('swarm_chat_history', JSON.stringify(messages));
  }, [messages]);
  
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

  // Static App ID
  const appId = 'swarm-board-main';

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 1. Auth & Data Init ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
        setAuthError(''); 
      } catch (error: any) {
        console.error("Auth Error:", error);
        setAuthError(error.message || 'Unknown Auth Error');
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

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      const resetState: Message[] = [{ id: 'welcome', role: 'ai', content: 'Greetings. I am the Swarm Leader of The Swarm Board. What\'d you like to know?.', timestamp: Date.now() }];
      setMessages(resetState);
      localStorage.removeItem('swarm_chat_history');
    }
  };

  const handleSaveSettings = async () => {
    if (!user) {
      alert("Error: You are not connected to the database. \n\nPossible fix: Enable 'Anonymous' in Firebase Authentication console.");
      return;
    }
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), {
        apiKey: apiKey
      }, { merge: true });
      
      alert("Success: API Key saved to database.");
    } catch (e: any) {
      console.error("Error saving config:", e);
      if (e.code === 'permission-denied') {
        alert("Permission Denied: Go to Firebase Console > Firestore > Rules and change 'allow write: if false' to 'allow write: if true'.");
      } else {
        alert(`Error saving: ${e.message}`);
      }
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
    if (!user) {
        alert("Error: Not authenticated. Cannot write to database.");
        return;
    }

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
      alert("Record added successfully.");
    } catch (e: any) {
      console.error("Error adding item:", e);
      if (e.code === 'permission-denied') {
        alert("Permission Denied: Check Firestore Rules in Firebase Console.");
      } else {
        alert("Error adding item.");
      }
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
      const queryKeywords = extractKeywords(userMsg.content);
      
      const scoredItems = knowledgeBase.map(item => {
        let score = 0;
        if (item.title.toLowerCase().includes(userMsg.content.toLowerCase())) score += 10;
        
        queryKeywords.forEach(qKey => {
          if (item.keywords && item.keywords.includes(qKey)) score += 2;
          if (item.content.toLowerCase().includes(qKey)) score += 1;
        });
        
        return { item, score };
      });

      const relevantContext = scoredItems
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(x => `[Source: ${x.item.title}]\n${x.item.content}`)
        .join('\n\n');

      // 3. Construct Prompt
      const systemPrompt = `
        You are the official AI Assistant for a crypto project. 
        Your goal is to answer user questions ACCURATELY based ONLY on the provided context.
        
        Tone: Professional, slightly futuristic, helpful, and concise.
        
        If the answer is not in the context, strictly state: "No one in the swarm has that intel. Sorry buddy."
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
    <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-[300px] md:h-full shadow-xl z-20">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3 bg-slate-900/50">
        <div className="w-8 h-8 rounded overflow-hidden">
          {/* SIDEBAR LOGO */}
          <img src={PROJECT_LOGO} alt="Logo" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-slate-100 tracking-wider text-sm">THE SWARM BOARD</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <button 
          onClick={() => setView('chat')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border ${view === 'chat' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-900/20' : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
        >
          <MessageSquare size={18} />
          <span className="font-medium">Swarm Chat</span>
        </button>

         {/* Clear History Button */}
        <button 
          onClick={handleClearHistory}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border border-transparent text-slate-400 hover:bg-slate-900 hover:text-red-400"
        >
          <RotateCcw size={18} />
          <span className="font-medium">Clear History</span>
        </button>

        <button 
          onClick={() => setView('admin')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border ${view === 'admin' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400 shadow-lg shadow-purple-900/20' : 'border-transparent text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
        >
          <ShieldCheck size={18} />
          <span className="font-medium">Admin Panel</span>
        </button>

      </div>

      <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
        {authError ? (
            <div className="flex items-center gap-2 text-xs text-red-400 font-mono animate-pulse">
                <AlertTriangle size={12} />
                AUTH ERROR: ENABLE ANON AUTH
            </div>
        ) : (
            <div className="flex items-center justify-center text-xs text-slate-500 font-mono opacity-70 hover:opacity-100 transition-opacity">
              Built with 🖤 by Mantissa | X: @dotmantissa
            </div>
        )}
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 flex flex-col h-full bg-slate-950 relative overflow-hidden font-sans">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 z-10 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
            {msg.role !== 'user' && (
              <div className="w-10 h-10 rounded-xl bg-emerald-950/50 flex items-center justify-center border border-emerald-500/20 shrink-0 shadow-lg shadow-emerald-900/10 overflow-hidden">
                {/* AI AVATAR IMAGE */}
                <img src={PROJECT_LOGO} alt="AI" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-5 leading-relaxed shadow-md ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : msg.role === 'system'
                ? 'bg-red-950/30 text-red-400 border border-red-500/30'
                : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none'
            }`}>
              <div className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</div>
              {msg.role === 'ai' && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-emerald-500/70 flex items-center gap-1 uppercase tracking-widest font-medium">
                  <ShieldCheck size={12} /> Verified Output
                </div>
              )}
            </div>

            {msg.role === 'user' && (
               <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
               <div className="w-3 h-3 rounded-full bg-slate-400" />
             </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 animate-in fade-in duration-300">
             <div className="w-10 h-10 rounded-xl bg-emerald-950/50 flex items-center justify-center border border-emerald-500/20 overflow-hidden">
                {/* LOADING AVATAR IMAGE */}
                <img src={PROJECT_LOGO} alt="Thinking" className="w-full h-full object-cover opacity-50" />
              </div>
              <div className="text-slate-500 text-sm flex items-center animate-pulse">
                Buzzing the Swarm for answers...
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-slate-900/80 backdrop-blur-md border-t border-slate-800 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Psst! Ask the swarm your questions..."
            className="flex-1 bg-slate-950 border border-slate-700 text-slate-200 px-5 py-4 rounded-xl focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-slate-600 shadow-inner"
          />
          <button 
            onClick={handleSendMessage}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transform active:scale-95"
          >
            <Send size={22} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => {
    if (!isAdminUnlocked) {
      return (
        <div className="flex-1 h-full bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 text-center shadow-2xl">
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto border border-slate-700 mb-6">
              <Lock size={32} className="text-slate-400" />
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
                placeholder="Passkey"
                className={`w-full bg-slate-950 border p-4 rounded-xl text-center text-slate-200 focus:outline-none transition-colors tracking-widest ${loginError ? 'border-red-500 shake' : 'border-slate-700 focus:border-emerald-500'}`}
              />
              {loginError && <p className="text-red-400 text-sm font-medium animate-pulse">Access Denied: Invalid credentials.</p>}
              <button 
                onClick={handleAdminLogin}
                className="w-full bg-slate-800 hover:bg-emerald-600 text-white py-4 rounded-xl transition-colors font-medium flex items-center justify-center gap-2 group"
              >
                <Unlock size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                Authenticate
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 h-full bg-slate-950 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="flex justify-between items-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                <ShieldCheck className="text-purple-400" />
                Admin Panel
              </h2>
              <p className="text-slate-400 mt-1">System Configuration & Knowledge Management</p>
            </div>
            <button 
              onClick={() => setIsAdminUnlocked(false)}
              className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors font-mono tracking-wide"
            >
              LOCK TERMINAL
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2">
              <Settings size={20} className="text-blue-400" />
              API Configuration
            </h3>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 space-y-2 w-full">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-bold ml-1">Gemini API Key</label>
                <div className="relative group">
                  <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl pl-12 text-slate-200 focus:border-blue-500 outline-none transition-all"
                  />
                  <Terminal size={18} className="absolute left-4 top-4.5 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
                </div>
              </div>
              <button 
                onClick={handleSaveSettings}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl transition-colors font-medium w-full md:w-auto"
              >
                Save Key
              </button>
            </div>
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
               <strong>Note:</strong> Key is stored securely in the database. All users will use this shared key automatically.
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2 px-1">
              <Database size={20} className="text-emerald-400" />
              Knowledge Base Management
            </h3>

            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Ingest New Data</h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Plus size={14} /> New Entry
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-xs text-slate-500 ml-1">Title</label>
                   <input 
                    placeholder="e.g. Tokenomics V2" 
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-slate-200 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-2">
                   <label className="text-xs text-slate-500 ml-1">Category</label>
                   <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-slate-200 focus:border-emerald-500 outline-none appearance-none"
                  >
                    <option value="General">General</option>
                    <option value="Roadmap">Roadmap</option>
                    <option value="Team">Team</option>
                    <option value="Technical">Technical</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                 <label className="text-xs text-slate-500 ml-1">Content / Facts</label>
                 <textarea 
                  placeholder="Paste context, facts, or whitepaper text here..." 
                  value={newItemContent}
                  onChange={(e) => setNewItemContent(e.target.value)}
                  className="w-full h-40 bg-slate-950 border border-slate-700 p-4 rounded-lg text-slate-200 focus:border-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleAddItem}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium transition-all hover:translate-y-[-1px]"
                >
                  <Save size={18} /> Save Record
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider px-1">Existing Records ({knowledgeBase.length})</h4>
              {knowledgeBase.length === 0 ? (
                <div className="text-center py-16 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30 flex flex-col items-center gap-2">
                  <Database size={32} className="opacity-20" />
                  <p>Database is empty. Ingest data above.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {knowledgeBase.map(item => (
                    <div key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl group hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex justify-between items-start shadow-sm">
                      <div className="flex-1 mr-6">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded text-slate-300 uppercase border border-slate-700 ${item.category === 'Technical' ? 'bg-blue-900/20 text-blue-300' : 'bg-slate-800'}`}>{item.category}</span>
                          <h4 className="font-semibold text-slate-200 text-base">{item.title}</h4>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 font-mono leading-relaxed pl-1">{item.content}</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-900/30"
                        title="Delete Record"
                      >
                        <Trash2 size={16} />
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
    <div className="flex flex-col md:flex-row h-screen w-full bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30 overflow-hidden">
      {renderSidebar()}
      {view === 'chat' ? renderChat() : renderAdmin()}
    </div>
  );
}
