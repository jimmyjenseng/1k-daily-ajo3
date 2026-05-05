import React, { useState, useEffect, useMemo } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { 
  LayoutDashboard, Users, Trophy, Shield, Clock, 
  CheckCircle2, AlertTriangle, Flame, Star, TrendingUp,
  Lock, Unlock, Save, Trash2, Calendar, ChevronRight
} from 'lucide-react';
import { db } from './firebase';
import { 
  collection, doc, setDoc, addDoc, onSnapshot, 
  query, orderBy, serverTimestamp, deleteDoc 
} from 'firebase/firestore';

// ─── CONFIGURATION ──────────────────────────────────────────────────────────
const START_DATE = new Date('2026-05-02T00:00:00');
const DAILY_AMT = 1000;
const GROUP_PW_ENC = btoa('2026'); 
const ADMIN_PW_ENC = btoa('3914'); // Your Admin PIN

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
    
    // Listen for Payments
    const unsubPmts = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), (s) => {
      setPayments(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Listen for Defaults
    const unsubSettings = onSnapshot(doc(db, 'settings', 'defaults'), (d) => {
      if (d.exists()) setDefaults(d.data().value || {});
      else setDefaults({});
    });

    return () => { unsubPmts(); unsubSettings(); };
  }, [unlocked]);

  // SCORING ENGINE
  const leaderboard = useMemo(() => {
    const now = new Date();
    const daysActive = Math.max(1, Math.floor((now.getTime() - START_DATE.getTime()) / 86400000) + 1);
    const requiredAmt = daysActive * DAILY_AMT;

    const stats = HANDS.map(hand => {
      const handPmts = payments.filter(p => Number(p.handNo) === hand.no);
      let totalPaid = 0;
      let score = 0;
      const bonusDays = new Set();

      handPmts.forEach(p => {
        const amt = Number(p.amount || 0);
        totalPaid += amt;
        score += (amt / 1000) * 10; 

        if (p.createdAt) {
          const dateObj = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
          const dayKey = dateObj.toLocaleDateString(); 
          
          if (dateObj.getHours() < 8 && !bonusDays.has(dayKey)) {
            score += 5;
            bonusDays.add(dayKey);
          }
        }
      });

      if (totalPaid >= requiredAmt && totalPaid > 0) score += 15;
      const dCount = defaults[hand.no] || 0;
      score -= (dCount * 25);

      return { 
        ...hand, 
        totalPaid, 
        score: Math.max(0, score), 
        isVanguard: totalPaid >= requiredAmt,
        defaultCount: dCount
      };
    });

    return stats.sort((a, b) => b.score - a.score || b.totalPaid - a.totalPaid);
  }, [payments, defaults]);

  const handleAdminAuth = () => {
    if (isAdmin) {
      setIsAdmin(false);
    } else {
      const pin = prompt("Enter Admin PIN:");
      if (btoa(pin) === ADMIN_PW_ENC) setIsAdmin(true);
      else toast.error("Unauthorized");
    }
  };

  if (!unlocked) return <Gate onUnlock={() => { localStorage.setItem('ajohub_access', '1'); setUnlocked(true); }} />;
  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24 selection:bg-[#22c55e]/30">
      <Toaster position="top-center" />
      
      <header className="p-6 border-b border-[#1e1e1e] flex justify-between items-center bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-[#22c55e] p-1.5 rounded-lg text-black font-bold shadow-lg shadow-[#22c55e]/20">₦</div>
          <h1 className="text-xl font-bold tracking-tight">AjoHub</h1>
        </div>
        <button onClick={handleAdminAuth} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${isAdmin ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[#1e1e1e] text-[#6b7280]'}`}>
          {isAdmin ? 'ADMIN ACTIVE' : 'ADMIN LOGIN'}
        </button>
      </header>

      <main className="max-w-md mx-auto p-4">
        {activeTab === 'dashboard' && <Dashboard stats={leaderboard} />}
        {activeTab === 'leaderboard' && <Rankings list={leaderboard} />}
        {activeTab === 'admin' && <AdminPanel payments={payments} defaults={defaults} isAdmin={isAdmin} />}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-xs bg-[#161616]/90 border border-[#2a2a2a] rounded-3xl p-2 flex justify-around items-center backdrop-blur-xl shadow-2xl z-50">
        <NavBtn active={activeTab === 'dashboard'} icon={LayoutDashboard} onClick={() => setActiveTab('dashboard')} />
        <NavBtn active={activeTab === 'leaderboard'} icon={Trophy} onClick={() => setActiveTab('leaderboard')} />
        <NavBtn active={activeTab === 'admin'} icon={Shield} onClick={() => setActiveTab('admin')} />
      </nav>
    </div>
  );
}

// ─── UI COMPONENTS ──────────────────────────────────────────────────────────

function Dashboard({ stats }) {
  const totalInVault = stats.reduce((sum, s) => sum + s.totalPaid, 0);
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-gradient-to-br from-[#1e1e1e] to-[#0a0a0a] p-8 rounded-[2rem] border border-[#2a2a2a] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={80} /></div>
        <p className="text-[#6b7280] text-xs font-bold uppercase tracking-widest">Global Contributions</p>
        <h2 className="text-5xl font-black mt-2 text-[#22c55e] tabular-nums">₦{totalInVault.toLocaleString()}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Users} label="Total Hands" val={HANDS.length} color="text-blue-400" />
        <StatCard icon={Flame} label="Highest Score" val={stats[0]?.score || 0} color="text-orange-500" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, val, color }) {
  return (
    <div className="bg-[#141414] p-5 rounded-3xl border border-[#2a2a2a]">
      <Icon className={`${color} mb-3`} size={24} />
      <p className="text-[10px] text-[#6b7280] font-bold uppercase tracking-tighter">{label}</p>
      <p className="text-2xl font-black">{val}</p>
    </div>
  );
}

function Rankings({ list }) {
  return (
    <div className="space-y-3 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-2 mb-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-[#6b7280]">Live Rankings</h3>
        <span className="bg-[#22c55e]/10 text-[#22c55e] text-[10px] px-2 py-1 rounded-md font-bold">UPDATED LIVE</span>
      </div>
      {list.map((member, i) => (
        <div key={member.no} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${i === 0 ? 'bg-[#22c55e]/5 border-[#22c55e]/30 scale-[1.02]' : 'bg-[#141414] border-[#222]'}`}>
          <div className="flex items-center gap-4">
            <span className={`text-xl font-black w-6 ${i === 0 ? 'text-[#22c55e]' : 'text-[#333]'}`}>{i + 1}</span>
            <div>
              <p className="font-bold text-sm flex items-center gap-2">
                {member.name}
                {member.isVanguard && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              </p>
              <p className="text-[10px] text-[#6b7280] font-medium">₦{member.totalPaid.toLocaleString()} Contribution</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-lg font-black ${i === 0 ? 'text-[#22c55e]' : 'text-white'}`}>{member.score}</p>
            <p className="text-[8px] font-bold text-[#444] tracking-widest uppercase">Points</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminPanel({ payments, defaults, isAdmin }) {
  const [hand, setHand] = useState(1);
  const [amt, setAmt] = useState(1000);
  const [mTime, setMTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAdmin) return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[#333]"><Lock /></div>
      <p className="text-sm text-[#6b7280] max-w-[200px]">Unlock Admin Mode in the header to manage logs.</p>
    </div>
  );

  const savePayment = async () => {
    setIsSubmitting(true);
    let finalTime = new Date();
    if (mTime) {
      const [h, m] = mTime.split(':');
      finalTime.setHours(parseInt(h), parseInt(m), 0);
    }
    try {
      await addDoc(collection(db, 'payments'), {
        handNo: Number(hand),
        amount: Number(amt),
        createdAt: finalTime,
        type: 'payment'
      });
      toast.success("Log successful");
      setMTime("");
    } catch (e) {
      toast.error("Error saving");
    }
    setIsSubmitting(false);
  };

  const toggleDefault = async (hNo, val) => {
    const currentVal = defaults[hNo] || 0;
    const newVal = Math.max(0, currentVal + val);
    await setDoc(doc(db, 'settings', 'defaults'), { value: { ...defaults, [hNo]: newVal } });
    toast.success("Default updated");
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-[#141414] p-6 rounded-[2rem] border border-[#222] space-y-4">
        <h4 className="font-black text-xs uppercase tracking-widest text-[#6b7280] mb-2">Record Payment</h4>
        <select value={hand} onChange={e => setHand(e.target.value)} className="w-full bg-[#0a0a0a] p-4 rounded-xl border border-[#2a2a2a] text-sm outline-none appearance-none">
          {HANDS.map(h => <option key={h.no} value={h.no}>{h.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="number" value={amt} onChange={e => setAmt(e.target.value)} className="flex-1 bg-[#0a0a0a] p-4 rounded-xl border border-[#2a2a2a] text-sm" placeholder="Amount" />
          <input type="time" value={mTime} onChange={e => setMTime(e.target.value)} className="w-32 bg-[#0a0a0a] p-4 rounded-xl border border-[#2a2a2a] text-sm text-white" />
        </div>
        <button disabled={isSubmitting} onClick={savePayment} className="w-full bg-[#22c55e] text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50">
          <Save size={18} /> {isSubmitting ? 'SAVING...' : 'SAVE LOG'}
        </button>
      </div>

      <div className="space-y-2">
        <h4 className="font-black text-xs uppercase tracking-widest text-[#6b7280] px-2 mb-4">Member Penalties</h4>
        {HANDS.map(h => (
          <div key={h.no} className="flex items-center justify-between bg-[#141414] p-4 rounded-2xl border border-[#222]">
            <span className="text-xs font-bold text-[#aaa]">{h.name}</span>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-black ${defaults[h.no] > 0 ? 'text-red-500' : 'text-[#333]'}`}>{defaults[h.no] || 0}</span>
              <div className="flex gap-1">
                <button onClick={() => toggleDefault(h.no, 1)} className="w-8 h-8 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center"><AlertTriangle size={14} /></button>
                <button onClick={() => toggleDefault(h.no, -1)} className="w-8 h-8 bg-[#2a2a2a] text-white rounded-lg flex items-center justify-center"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NavBtn({ active, icon: Icon, onClick }) {
  return (
    <button onClick={onClick} className={`p-4 rounded-2xl transition-all duration-300 ${active ? 'bg-[#22c55e] text-black shadow-lg shadow-[#22c55e]/20' : 'text-[#555] hover:text-white'}`}>
      <Icon size={20} strokeWidth={3} />
    </button>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-[#1e1e1e] border-t-[#22c55e] rounded-full animate-spin" />
      <p className="text-[10px] font-black tracking-widest text-[#6b7280] uppercase">Syncing Cloud Ledger</p>
    </div>
  );
}

function Gate({ onUnlock }) {
  const [pw, setPw] = useState("");
  const check = () => {
    if (btoa(pw) === GROUP_PW_ENC) {
      onUnlock();
    } else {
      toast.error("Invalid Access Code");
      setPw("");
    }
  };
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8 text-white">
      <div className="w-full max-w-xs space-y-8">
        <div className="w-20 h-20 bg-[#22c55e]/10 text-[#22c55e] rounded-[2.5rem] flex items-center justify-center text-4xl mx-auto font-black shadow-inner">₦</div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black">AjoHub</h1>
          <p className="text-xs text-[#555] font-bold uppercase tracking-widest">Enter Group Portal</p>
        </div>
        <input 
          type="password" 
          value={pw} 
          onChange={e => setPw(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && check()}
          className="w-full bg-[#141414] border border-[#2a2a2a] p-5 rounded-3xl text-center outline-none focus:border-[#22c55e] transition-all font-black tracking-widest" 
          placeholder="••••" 
        />
        <button onClick={check} className="w-full bg-white text-black font-black py-5 rounded-3xl hover:bg-[#22c55e] transition-all active:scale-95 shadow-xl">AUTHENTICATE</button>
      </div>
    </div>
  );
}
