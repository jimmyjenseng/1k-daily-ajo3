import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Trophy, Shield, Clock, 
  AlertTriangle, Flame, Star, TrendingUp,
  Lock, Save, Trash2, Calendar
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

  // ─── THE SCORING ENGINE ───────────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const today = new Date();
    const daysSinceStart = Math.max(1, Math.floor((today - START_DATE) / (1000 * 60 * 60 * 24)) + 1);
    const targetAmount = daysSinceStart * DAILY_AMT;

    const results = HANDS.map(hand => {
      const myPmts = payments.filter(p => Number(p.handNo) === hand.no);
      let totalCash = 0;
      let calculatedScore = 0;
      const bonusDays = new Set();

      myPmts.forEach(p => {
        const amt = Number(p.amount || 0);
        totalCash += amt;
        
        // 1. Base Score: 10 pts per 1k
        calculatedScore += (amt / 1000) * 10;

        // 2. Early Bird (+5 pts): Must be before 8:00 AM on the day logged
        if (p.createdAt) {
          const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
          const dayString = d.toDateString(); 
          if (d.getHours() < 8 && !bonusDays.has(dayString)) {
            calculatedScore += 5;
            bonusDays.add(dayString);
          }
        }
      });

      // 3. Vanguard (+15 pts): Currently ahead of the total required amount
      const isVanguard = totalCash >= targetAmount && totalCash > 0;
      if (isVanguard) calculatedScore += 15;

      // 4. Default Penalty (-25 pts per default)
      const penaltyCount = defaults[hand.no] || 0;
      calculatedScore -= (penaltyCount * 25);

      return { 
        ...hand, 
        totalPaid: totalCash, 
        score: Math.max(0, calculatedScore), 
        isVanguard,
        penaltyCount
      };
    });

    return results.sort((a, b) => b.score - a.score || b.totalPaid - a.totalPaid);
  }, [payments, defaults]);

  const handleAdminAuth = () => {
    if (isAdmin) return setIsAdmin(false);
    const pin = prompt("Enter Admin PIN:");
    if (btoa(pin) === ADMIN_PW_ENC) setIsAdmin(true);
    else toast.error("Incorrect PIN");
  };

  if (!unlocked) return <Gate onUnlock={() => { localStorage.setItem('ajohub_access', '1'); setUnlocked(true); }} />;
  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono">LOADING LEDGER...</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-28">
      <Toaster position="top-center" />
      
      <header className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#22c55e] p-1.5 rounded-lg text-black font-black">₦</div>
          <h1 className="text-xl font-black tracking-tighter italic">AjoHub</h1>
        </div>
        <button onClick={handleAdminAuth} className={`text-[10px] font-black px-4 py-2 rounded-full transition-all ${isAdmin ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'}`}>
          {isAdmin ? 'ADMIN: ON' : 'ADMIN: OFF'}
        </button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {activeTab === 'dashboard' && <Dashboard stats={leaderboard} />}
        {activeTab === 'leaderboard' && <Rankings list={leaderboard} />}
        {activeTab === 'admin' && <AdminPanel payments={payments} defaults={defaults} isAdmin={isAdmin} />}
      </main>

      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xs bg-white/5 border border-white/10 rounded-full p-2 flex justify-around items-center backdrop-blur-2xl shadow-2xl z-50">
        <NavBtn active={activeTab === 'dashboard'} icon={LayoutDashboard} onClick={() => setActiveTab('dashboard')} />
        <NavBtn active={activeTab === 'leaderboard'} icon={Trophy} onClick={() => setActiveTab('leaderboard')} />
        <NavBtn active={activeTab === 'admin'} icon={Shield} onClick={() => setActiveTab('admin')} />
      </nav>
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ stats }) {
  const totalVault = stats.reduce((sum, s) => sum + s.totalPaid, 0);
  return (
    <div className="space-y-6 animate-in zoom-in-95 duration-500">
      <div className="bg-gradient-to-br from-[#111] to-black p-8 rounded-[2.5rem] border border-white/5 shadow-inner">
        <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Total Contributions</p>
        <h2 className="text-5xl font-black text-[#22c55e] tabular-nums">₦{totalVault.toLocaleString()}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
          <TrendingUp className="text-blue-500 mb-2" size={20} />
          <p className="text-[10px] text-white/40 font-bold uppercase">Active Hands</p>
          <p className="text-2xl font-black">{HANDS.length}</p>
        </div>
        <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
          <Flame className="text-orange-500 mb-2" size={20} />
          <p className="text-[10px] text-white/40 font-bold uppercase">Leader Score</p>
          <p className="text-2xl font-black">{stats[0]?.score || 0}</p>
        </div>
      </div>
    </div>
  );
}

// ─── RANKINGS ───────────────────────────────────────────────────────────────
function Rankings({ list }) {
  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-4 duration-700">
      <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest px-2">Global Leaderboard</h3>
      {list.map((member, i) => (
        <div key={member.no} className={`flex items-center justify-between p-5 rounded-[2rem] border transition-all ${i === 0 ? 'bg-[#22c55e]/10 border-[#22c55e]/30' : 'bg-white/5 border-white/5'}`}>
          <div className="flex items-center gap-4">
            <span className={`text-xl font-black ${i === 0 ? 'text-[#22c55e]' : 'text-white/20'}`}>{i + 1}</span>
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                {member.name}
                {member.isVanguard && <Star size={12} className="fill-blue-500 text-blue-500 animate-pulse" />}
              </p>
              <p className="text-[10px] text-white/40 font-bold tracking-tight">₦{member.totalPaid.toLocaleString()} Paid</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-xl font-black ${i === 0 ? 'text-[#22c55e]' : 'text-white'}`}>{member.score}</p>
            <p className="text-[8px] font-black uppercase opacity-30">Points</p>
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

  if (!isAdmin) return <div className="text-center py-20 opacity-20 font-black italic">ADMIN RESTRICTED</div>;

  const savePayment = async () => {
    // Correctly merging Date and Time
    let finalDate = new Date(mDate);
    if (mTime) {
      const [h, m] = mTime.split(':');
      finalDate.setHours(parseInt(h), parseInt(m), 0);
    } else {
      const now = new Date();
      finalDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    }

    try {
      await addDoc(collection(db, 'payments'), {
        handNo: Number(hand),
        amount: Number(amt),
        createdAt: Timestamp.fromDate(finalDate),
      });
      toast.success("Payment Recorded");
      setMTime("");
    } catch (e) { toast.error("Sync Error"); }
  };

  const adjustDefault = async (hNo, inc) => {
    const newVal = Math.max(0, (defaults[hNo] || 0) + inc);
    await setDoc(doc(db, 'settings', 'defaults'), { value: { ...defaults, [hNo]: newVal } });
    toast.success("Defaults Updated");
  };

  return (
    <div className="space-y-8 pb-10 animate-in fade-in duration-500">
      <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 space-y-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">New Payment Entry</h4>
        <select value={hand} onChange={e => setHand(e.target.value)} className="w-full bg-black p-4 rounded-2xl border border-white/10 text-sm font-bold">
          {HANDS.map(h => <option key={h.no} value={h.no}>{h.name}</option>)}
        </select>
        <input type="number" value={amt} onChange={e => setAmt(e.target.value)} className="w-full bg-black p-4 rounded-2xl border border-white/10 text-sm" placeholder="Amount" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={mDate} onChange={e => setMDate(e.target.value)} className="bg-black p-4 rounded-2xl border border-white/10 text-xs text-white" />
          <input type="time" value={mTime} onChange={e => setMTime(e.target.value)} className="bg-black p-4 rounded-2xl border border-white/10 text-xs text-white" />
        </div>
        <button onClick={savePayment} className="w-full bg-[#22c55e] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#22c55e]/10">
          <Save size={18} /> CONFIRM LOG
        </button>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 px-2">Member Default Management</h4>
        {HANDS.map(h => (
          <div key={h.no} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
            <span className="text-xs font-bold text-white/60">{h.name}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs font-black text-red-500">{defaults[h.no] || 0}</span>
              <div className="flex gap-2">
                <button onClick={() => adjustDefault(h.no, 1)} className="w-8 h-8 bg-red-500 text-white rounded-lg flex items-center justify-center"><AlertTriangle size={14} /></button>
                <button onClick={() => adjustDefault(h.no, -1)} className="w-8 h-8 bg-white/10 text-white rounded-lg flex items-center justify-center"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHARED COMPONENTS ──────────────────────────────────────────────────────
function NavBtn({ active, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-full transition-all duration-500 ${active ? 'bg-[#22c55e] text-black shadow-lg shadow-[#22c55e]/20' : 'text-white/20 hover:text-white'}`}>
      <Icon size={20} strokeWidth={3} />
    </button>
  );
}

function Gate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const check = () => btoa(pw) === GROUP_PW_ENC ? onUnlock() : toast.error("Access Denied");
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-8">
      <div className="w-full max-w-xs space-y-8 text-center">
        <div className="w-20 h-20 bg-[#22c55e]/10 text-[#22c55e] rounded-[2rem] flex items-center justify-center text-3xl font-black mx-auto shadow-inner">₦</div>
        <h1 className="text-3xl font-black tracking-tighter">AJOHUB</h1>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()} className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-center outline-none focus:border-[#22c55e] transition-all font-black text-xl" placeholder="••••" />
        <button onClick={check} className="w-full bg-white text-black font-black py-5 rounded-3xl active:scale-95 transition-all">UNLOOCK</button>
      </div>
    </div>
  );
}
