import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Trophy, Shield, Trash2, 
  Calendar, Clock, Star, AlertTriangle, Save, ChevronRight
} from 'lucide-react';
import { db } from './firebase';
import { 
  collection, doc, setDoc, addDoc, onSnapshot, 
  query, orderBy, deleteDoc, Timestamp 
} from 'firebase/firestore';

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const START_DATE = new Date('2026-05-02T00:00:00');
const DAILY_AMT = 1000;
const GROUP_PW_ENC = btoa('2026'); 
const ADMIN_PW_ENC = btoa('3914'); 

const HANDS = [
  { no:1,  name:'Mummy David 1'  }, { no:2,  name:'ID 1'          }, { no:3,  name:'Sis Esther 1'  },
  { no:4,  name:'Mr Akeem'       }, { no:5,  name:'Sis Esther 2'  }, { no:6,  name:'Mrs Dosu'      },
  { no:7,  name:'T&K 1'          }, { no:8,  name:'Mummy Ola 1'   }, { no:9,  name:'Bidex 1'       },
  { no:10, name:'Sis Esther 3'   }, { no:11, name:'T&K 2'         }, { no:12, name:'Mummy Aishat'  },
  { no:13, name:'ID 2'           }, { no:14, name:'Bidex 2'        }, { no:15, name:'Mummy David 2' },
  { no:16, name:'Mr Habeeb'      }, { no:17, name:'Mrs Abiola 1'  }, { no:18, name:'Sis Tomi 1'    },
  { no:19, name:'Mrs Abiola 2'   }, { no:20, name:'Esther 1'      }, { no:21, name:'Mummy Ola 2'   },
  { no:22, name:'Sis Tomi 2'     }, { no:23, name:'Sis Tomi 3'   }, { no:24, name:'ID 3'           },
  { no:25, name:'Esther 2'       }, { no:26, name:'Mummy Awal'   }, { no:27, name:'Sis Tomi 4'    },
  { no:28, name:'Mathew'         }, { no:29, name:'Mrs Abiola 3'  }, { no:30, name:'T&K 3'         },
];

export default function AjoHub() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem('ajohub_access') === '1');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [defaults, setDefaults] = useState({});

  useEffect(() => {
    if (!unlocked) return;
    const unsubPmts = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), (s) => {
      setPayments(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubSettings = onSnapshot(doc(db, 'settings', 'defaults'), (d) => {
      setDefaults(d.exists() ? d.data().value || {} : {});
    });
    return () => { unsubPmts(); unsubSettings(); };
  }, [unlocked]);

  const leaderboard = useMemo(() => {
    const today = new Date();
    const daysSinceStart = Math.max(1, Math.floor((today - START_DATE) / 86400000) + 1);
    const targetAmount = daysSinceStart * DAILY_AMT;

    return HANDS.map(hand => {
      const myPmts = payments.filter(p => Number(p.handNo) === hand.no);
      let totalCash = 0;
      let score = 0;
      const bonusDays = new Set();

      myPmts.forEach(p => {
        const amt = Number(p.amount || 0);
        totalCash += amt;
        score += (amt / 1000) * 10;
        if (p.createdAt) {
          const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
          if (d.getHours() < 8 && !bonusDays.has(d.toDateString())) {
            score += 5;
            bonusDays.add(d.toDateString());
          }
        }
      });

      const isVanguard = totalCash >= targetAmount && totalCash > 0;
      if (isVanguard) score += 15;
      score -= ((defaults[hand.no] || 0) * 25);

      return { ...hand, totalPaid: totalCash, score: Math.max(0, score), isVanguard };
    }).sort((a, b) => b.score - a.score || b.totalPaid - a.totalPaid);
  }, [payments, defaults]);

  const nextCollector = useMemo(() => {
    const paidHands = payments.filter(p => p.type === 'collection').map(p => Number(p.handNo));
    return HANDS.find(h => !paidHands.includes(h.no)) || HANDS[0];
  }, [payments]);

  const handleAdminAuth = () => {
    if (isAdmin) return setIsAdmin(false);
    const pin = prompt("Enter Admin PIN:");
    if (btoa(pin) === ADMIN_PW_ENC) setIsAdmin(true);
    else toast.error("Invalid PIN");
  };

  if (!unlocked) return <Gate onUnlock={() => { localStorage.setItem('ajohub_access', '1'); setUnlocked(true); }} />;
  if (loading) return <div className="p-10 text-center font-bold">Connecting...</div>;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 pb-24 font-sans">
      <Toaster />
      <header className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2 font-black text-xl tracking-tighter">
          <span className="bg-green-600 text-white w-8 h-8 flex items-center justify-center rounded-lg">₦</span>
          AJOHUB
        </div>
        <button onClick={handleAdminAuth} className={`text-[10px] font-bold px-3 py-1 rounded border ${isAdmin ? 'bg-red-50 border-red-200 text-red-600' : 'text-slate-400'}`}>
          {isAdmin ? 'ADMIN ACTIVE' : 'ADMIN LOGIN'}
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {activeTab === 'dashboard' && <Dashboard stats={leaderboard} next={nextCollector} logs={payments} isAdmin={isAdmin} />}
        {activeTab === 'leaderboard' && <Rankings list={leaderboard} />}
        {activeTab === 'admin' && <AdminPanel defaults={defaults} isAdmin={isAdmin} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex justify-around items-center shadow-lg">
        <NavBtn active={activeTab === 'dashboard'} icon={LayoutDashboard} label="Home" onClick={() => setActiveTab('dashboard')} />
        <NavBtn active={activeTab === 'leaderboard'} icon={Trophy} label="Rank" onClick={() => setActiveTab('leaderboard')} />
        <NavBtn active={activeTab === 'admin'} icon={Shield} label="Admin" onClick={() => setActiveTab('admin')} />
      </nav>
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ stats, next, logs, isAdmin }) {
  const totalVault = stats.reduce((sum, s) => sum + s.totalPaid, 0);

  const deleteLog = async (id) => {
    if (window.confirm("Delete this entry?")) {
      await deleteDoc(doc(db, 'payments', id));
      toast.success("Entry removed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total Vault</p>
        <h2 className="text-4xl font-black text-green-600">₦{totalVault.toLocaleString()}</h2>
      </div>

      <div className="bg-white p-5 rounded-2xl border flex justify-between items-center">
        <div>
          <p className="text-slate-400 text-[10px] font-bold uppercase">Next Collector</p>
          <p className="font-bold text-lg">{next.name}</p>
        </div>
        <div className="bg-blue-50 text-blue-600 p-2 rounded-xl"><ChevronRight /></div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase text-slate-400 px-1">Recent Activity</h3>
        <div className="space-y-2">
          {logs.slice(0, 10).map(log => {
            const member = HANDS.find(h => h.no === Number(log.handNo));
            const date = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recent';
            return (
              <div key={log.id} className="bg-white p-4 rounded-xl border flex justify-between items-center group">
                <div>
                  <p className="font-bold text-sm">{member?.name || 'Unknown'}</p>
                  <p className="text-[10px] text-slate-400">{date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-green-600 text-sm">₦{Number(log.amount).toLocaleString()}</span>
                  {isAdmin && (
                    <button onClick={() => deleteLog(log.id)} className="text-red-300 hover:text-red-600 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── RANKINGS ───────────────────────────────────────────────────────────────
function Rankings({ list }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase text-slate-400 px-1 mb-4">Member Standings</h3>
      {list.map((m, i) => (
        <div key={m.no} className="bg-white p-4 rounded-xl border flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className={`font-black w-4 text-center ${i < 3 ? 'text-green-600' : 'text-slate-300'}`}>{i + 1}</span>
            <div>
              <p className="font-bold text-sm flex items-center gap-1">
                {m.name} {m.isVanguard && <Star size={10} className="text-blue-500 fill-blue-500" />}
              </p>
              <p className="text-[10px] text-slate-400">Total: ₦{m.totalPaid.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-black text-lg">{m.score}</p>
            <p className="text-[8px] uppercase font-bold text-slate-300">Points</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ADMIN PANEL ────────────────────────────────────────────────────────────
function AdminPanel({ defaults, isAdmin }) {
  const [hand, setHand] = useState(1);
  const [amt, setAmt] = useState(1000);
  const [mDate, setMDate] = useState(new Date().toISOString().split('T')[0]);
  const [mTime, setMTime] = useState("");

  if (!isAdmin) return <div className="py-20 text-center text-slate-300 font-bold">ADMIN ACCESS ONLY</div>;

  const savePayment = async () => {
    let finalDate = new Date(mDate);
    if (mTime) {
      const [h, m] = mTime.split(':');
      finalDate.setHours(parseInt(h), parseInt(m), 0);
    }
    try {
      await addDoc(collection(db, 'payments'), {
        handNo: Number(hand),
        amount: Number(amt),
        createdAt: Timestamp.fromDate(finalDate),
        type: 'payment'
      });
      toast.success("Log Saved");
      setMTime("");
    } catch (e) { toast.error("Error"); }
  };

  const adjustDefault = async (hNo, inc) => {
    const newVal = Math.max(0, (defaults[hNo] || 0) + inc);
    await setDoc(doc(db, 'settings', 'defaults'), { value: { ...defaults, [hNo]: newVal } });
    toast.success("Updated");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <h4 className="text-xs font-bold uppercase text-slate-400">Log Contribution</h4>
        <select value={hand} onChange={e => setHand(e.target.value)} className="w-full p-3 rounded-lg border bg-gray-50 font-bold text-sm">
          {HANDS.map(h => <option key={h.no} value={h.no}>{h.name}</option>)}
        </select>
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)} className="w-full p-3 rounded-lg border text-sm" placeholder="Amount" />
        <div className="flex gap-2">
          <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} className="flex-1 p-3 rounded-lg border text-xs" />
          <input type="time" value={mTime} onChange={e => setMTime(e.target.value)} className="flex-1 p-3 rounded-lg border text-xs" />
        </div>
        <button onClick={savePayment} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">
          <Save size={18} /> SAVE ENTRY
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase text-slate-400 px-1">Penalties / Defaults</h4>
        {HANDS.map(h => (
          <div key={h.no} className="bg-white p-3 rounded-xl border flex justify-between items-center">
            <span className="text-xs font-bold">{h.name}</span>
            <div className="flex items-center gap-3">
              <span className="text-red-600 font-black text-xs">{defaults[h.no] || 0}</span>
              <button onClick={() => adjustDefault(h.no, 1)} className="bg-red-50 text-red-600 p-1 rounded"><AlertTriangle size={14}/></button>
              <button onClick={() => adjustDefault(h.no, -1)} className="bg-gray-100 p-1 rounded"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── HELPERS ────────────────────────────────────────────────────────────────
function NavBtn({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-green-600' : 'text-slate-300'}`}>
      <Icon size={20} strokeWidth={active ? 3 : 2} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function Gate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const check = () => btoa(pw) === GROUP_PW_ENC ? onUnlock() : toast.error("Denied");
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center space-y-6">
        <div className="bg-green-600 text-white w-16 h-16 flex items-center justify-center rounded-2xl mx-auto text-2xl font-black">₦</div>
        <h1 className="text-2xl font-black italic">AJOHUB</h1>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} className="w-full p-4 rounded-xl border text-center font-bold tracking-widest shadow-sm outline-none focus:ring-2 ring-green-600/20" placeholder="PIN" />
        <button onClick={check} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg">ENTER PORTAL</button>
      </div>
    </div>
  );
}
