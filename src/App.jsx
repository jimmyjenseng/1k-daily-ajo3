import React, { useState, useEffect, useCallback, useMemo } from ‘react’;
import toast, { Toaster } from ‘react-hot-toast’;
import {
LayoutDashboard, Users, Trophy, Shield,
Lock, Unlock, Edit2, Trash2, X, Download, RefreshCw,
WifiOff, CheckCircle2, XCircle, AlertTriangle, Flame,
Star, Gift, TrendingUp, Calendar, Coins, Eye, EyeOff,
ArrowRightLeft,
} from ‘lucide-react’;
import { db } from ‘./firebase’;
import {
collection, doc, setDoc, addDoc, updateDoc,
deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from ‘firebase/firestore’;

// ─── Constants ────────────────────────────────────────────────────────────────
const START_DATE  = new Date(‘2026-05-02T00:00:00’);
const DAILY_AMT   = 1000;
const FINE_AMT    = 500;
const TOTAL_HANDS = 30;

// Password encoding: we use btoa(password) for storage/comparison.
// Simple, consistent, and never stored as plain text in source code.
// Default group password: 2026  → stored as btoa(“2026”)
// Default admin password: 3914  → stored as btoa(“3914”)
const encode = (pw) => btoa(unescape(encodeURIComponent(pw.trim())));
const DEFAULT_GROUP_ENC = encode(‘2026’);
const DEFAULT_ADMIN_ENC = encode(‘3914’);

const HANDS = [
{ no:1,  name:‘Mummy David 1’  }, { no:2,  name:‘ID 1’          }, { no:3,  name:‘Sis Esther 1’  },
{ no:4,  name:‘Mr Akeem’       }, { no:5,  name:‘Sis Esther 2’  }, { no:6,  name:‘Mrs Dosu’      },
{ no:7,  name:‘T&K 1’          }, { no:8,  name:‘Mummy Ola 1’   }, { no:9,  name:‘Bidex 1’       },
{ no:10, name:‘Sis Esther 3’   }, { no:11, name:‘T&K 2’         }, { no:12, name:‘Mummy Aishat’  },
{ no:13, name:‘ID 2’           }, { no:14, name:‘Bidex 2’        }, { no:15, name:‘Mummy David 2’ },
{ no:16, name:‘Mr Habeeb’      }, { no:17, name:‘Mrs Abiola 1’  }, { no:18, name:‘Sis Tomi 1’    },
{ no:19, name:‘Mrs Abiola 2’   }, { no:20, name:‘Esther 1’      }, { no:21, name:‘Mummy Ola 2’   },
{ no:22, name:‘Sis Tomi 2’     }, { no:23, name:‘Sis Tomi 3’   }, { no:24, name:‘ID 3’           },
{ no:25, name:‘Esther 2’       }, { no:26, name:‘Mummy Awal’   }, { no:27, name:‘Sis Tomi 4’    },
{ no:28, name:‘Mathew’         }, { no:29, name:‘Mrs Abiola 3’  }, { no:30, name:‘T&K 3’         },
];
const DEFAULT_ORDER = HANDS.map(h => h.no);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt           = n  => ‘\u20a6’ + Number(n).toLocaleString(‘en-NG’);
const todayKey      = () => new Date().toISOString().slice(0, 10);
const isAfter9      = () => new Date().getHours() >= 21;
const daysSince     = () => Math.max(0, Math.floor((Date.now() - START_DATE.getTime()) / 86_400_000));
const currentTimeStr = () => {
const now = new Date();
return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
};
// Rewards scoring helpers
const isEarlyPayment  = (timeStr) => { if (!timeStr) return false; const [h] = timeStr.split(’:’).map(Number); return h < 8; };
const isOnTimePayment = (timeStr) => { if (!timeStr) return true; const [h] = timeStr.split(’:’).map(Number); return h < 21; };
// Current ISO week string e.g. “2026-W18”
const isoWeekKey = (dateStr) => {
const d = new Date(dateStr || todayKey());
const jan4 = new Date(d.getFullYear(), 0, 4);
const weekNo = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
};

// ─── Firebase helpers ─────────────────────────────────────────────────────────
const fbSet = (key, val) => setDoc(doc(db, ‘settings’, key), { value: val });

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Pill({ children, variant = ‘gray’ }) {
const c = {
gray:   ‘bg-[#2a2a2a] text-[#a3a3a3]’,
green:  ‘bg-green-500/10 text-green-400 border border-green-500/20’,
red:    ‘bg-red-500/10 text-red-400 border border-red-500/20’,
yellow: ‘bg-yellow-500/10 text-yellow-400 border border-yellow-500/20’,
blue:   ‘bg-blue-500/10 text-blue-400 border border-blue-500/20’,
}[variant] || ‘bg-[#2a2a2a] text-[#a3a3a3]’;
return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium ${c}`}>{children}</span>;
}

function ProgressBar({ pct, color = ‘#22c55e’ }) {
return (
<div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
<div className=“h-full rounded-full transition-all duration-700” style={{ width: `${Math.min(100, pct)}%`, background: color }} />
</div>
);
}

function StatCard({ icon: Icon, label, value, sub, accent }) {
return (
<div className="card p-5 flex flex-col gap-2">
<div className="flex items-center justify-between">
<span className="text-[#6b7280] text-[10px] font-medium uppercase tracking-widest">{label}</span>
<div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? 'bg-[#22c55e]/10' : 'bg-[#2a2a2a]'}`}>
<Icon size={14} className={accent ? ‘text-[#22c55e]’ : ‘text-[#6b7280]’} />
</div>
</div>
<div className="font-display text-2xl text-white leading-none">{value}</div>
{sub && <div className="text-[11px] text-[#6b7280]">{sub}</div>}
</div>
);
}

function Modal({ open, onClose, title, children }) {
useEffect(() => {
document.body.style.overflow = open ? ‘hidden’ : ‘’;
return () => { document.body.style.overflow = ‘’; };
}, [open]);
if (!open) return null;
return (
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
<div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
<div className="relative bg-[#141414] border border-[#2a2a2a] rounded-3xl w-full max-w-md max-h-[90dvh] overflow-y-auto animate-slide-up">
<div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
<h3 className="font-display text-lg text-white">{title}</h3>
<button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#2a2a2a] transition-colors">
<X size={15} className="text-[#6b7280]" />
</button>
</div>
<div className="p-5">{children}</div>
</div>
</div>
);
}

function Spinner({ label = ‘Loading…’ }) {
return (
<div className="flex flex-col items-center justify-center py-24 gap-4">
<div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] border-t-[#22c55e] animate-spin" />
<p className="text-[#6b7280] text-sm">{label}</p>
</div>
);
}

function PwInput({ value, onChange, placeholder, onEnter, hasError }) {
const [show, setShow] = useState(false);
return (
<div className="relative">
<input
type={show ? ‘text’ : ‘password’}
className={`input pr-11 ${hasError ? 'border-red-500' : ''}`}
placeholder={placeholder}
value={value}
autoFocus
onChange={e => onChange(e.target.value)}
onKeyDown={e => e.key === ‘Enter’ && onEnter?.()}
/>
<button type=“button” onClick={() => setShow(s => !s)}
className=“absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-white transition-colors”>
{show ? <EyeOff size={15} /> : <Eye size={15} />}
</button>
</div>
);
}

// ─── Group Gate ───────────────────────────────────────────────────────────────
function GroupGate({ onUnlock, groupEnc }) {
const [pw,  setPw]  = useState(’’);
const [err, setErr] = useState(false);

const attempt = () => {
// Compare encoded version of what user typed against stored encoded password
const stored = groupEnc || DEFAULT_GROUP_ENC;
if (encode(pw) === stored) {
sessionStorage.setItem(‘ajohub_access’, ‘1’);
onUnlock();
} else {
setErr(true);
setPw(’’);
}
};

return (
<div className="min-h-dvh bg-[#0a0a0a] flex flex-col items-center justify-center px-6">
<div className="w-full max-w-sm flex flex-col items-center gap-8 animate-fade-in">
<div className="flex flex-col items-center gap-4">
<div className="w-20 h-20 rounded-3xl bg-[#22c55e]/10 border border-[#22c55e]/20 flex items-center justify-center">
<span className=“text-4xl text-[#22c55e]” style={{ fontFamily: ‘serif’, fontWeight: 700 }}>₦</span>
</div>
<div className="text-center">
<h1 className="font-display text-4xl text-white">AjoHub</h1>
<p className="text-[#6b7280] text-sm mt-1">Private group savings — members only</p>
</div>
</div>

```
    <div className="card w-full p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#2a2a2a] flex items-center justify-center shrink-0">
          <Shield size={16} className="text-[#22c55e]" />
        </div>
        <div>
          <p className="text-white text-sm font-medium">Members Access</p>
          <p className="text-[#6b7280] text-xs">Enter your group password to continue</p>
        </div>
      </div>

      <PwInput
        value={pw}
        onChange={v => { setPw(v); setErr(false); }}
        placeholder="Group password..."
        onEnter={attempt}
        hasError={err}
      />

      {err && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
          <XCircle size={13} className="shrink-0" />
          Wrong password. Contact your group admin.
        </div>
      )}

      <button className="btn-primary w-full py-3" onClick={attempt}>
        Enter AjoHub
      </button>
    </div>

    <p className="text-[#2a2a2a] text-xs text-center">
      Unauthorised access is not permitted.
    </p>
  </div>
</div>
```

);
}

// ─── Admin Gate (modal) ───────────────────────────────────────────────────────
function AdminGate({ onUnlock, onClose, adminEnc }) {
const [pw,  setPw]  = useState(’’);
const [err, setErr] = useState(false);

const attempt = () => {
const stored = adminEnc || DEFAULT_ADMIN_ENC;
if (encode(pw) === stored) onUnlock();
else { setErr(true); setPw(’’); }
};

return (
<Modal open onClose={onClose} title="Admin Access">
<div className="flex flex-col gap-4">
<p className="text-[#6b7280] text-sm">Enter the admin password to continue.</p>
<PwInput value={pw} onChange={v => { setPw(v); setErr(false); }} placeholder=“Admin password…” onEnter={attempt} hasError={err} />
{err && <p className="text-red-400 text-xs">Incorrect admin password.</p>}
<button className="btn-primary w-full" onClick={attempt}>Unlock</button>
</div>
</Modal>
);
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────
function Dashboard({ payments, order, fines, defaults, checkins }) {
const elapsed       = daysSince();
const collectorNo   = order[elapsed] ?? null;
const collectorHand = HANDS.find(h => h.no === collectorNo);
const totalCollected= payments.reduce((s, p) => s + p.amount, 0);
const totalFines    = Object.values(fines).reduce((s, v) => s + v, 0);
const todayPmts     = payments.filter(p => p.date === todayKey());
const todayTotal    = todayPmts.reduce((s, p) => s + p.amount, 0);
const pct           = elapsed > 0 ? (elapsed / TOTAL_HANDS) * 100 : 0;

const getStreak = useCallback((handNo) => {
const dates = payments.filter(p => p.handNo === handNo).map(p => p.date).sort().reverse();
let streak = 0;
let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
for (const d of dates) {
const dt = new Date(d); dt.setHours(0, 0, 0, 0);
if (Math.round((cursor - dt) / 86400000) <= 1) { streak++; cursor = dt; } else break;
}
return streak;
}, [payments]);

const leaderboard = useMemo(() =>
[…HANDS].map(h => ({
…h,
paidDays: payments.filter(p => p.handNo === h.no).length,
streak: getStreak(h.no),
fines: fines[h.no] || 0,
})).sort((a, b) => b.paidDays - a.paidDays).slice(0, 5),
[payments, fines, getStreak]
);

const recentPmts = […payments]
.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
.slice(0, 5);

return (
<div className="flex flex-col gap-4 animate-fade-in">
{/* Hero */}
{collectorHand && (
<div className=“card p-6 relative overflow-hidden” style={{ borderColor: ‘rgba(34,197,94,0.3)’ }}>
<div className="absolute inset-0 bg-gradient-to-br from-[#22c55e]/5 to-transparent pointer-events-none" />
<div className="relative">
<div className="flex items-start justify-between mb-4">
<div>
<span className="text-[10px] text-[#6b7280] uppercase tracking-widest font-medium">Today’s Collector</span>
<h2 className="font-display text-3xl text-white mt-1 leading-none">{collectorHand.name}</h2>
<p className="text-[#6b7280] text-sm mt-1.5">Hand #{collectorHand.no} · Day {elapsed + 1} of {TOTAL_HANDS}</p>
</div>
<span className="text-4xl select-none">🎉</span>
</div>
<ProgressBar pct={pct} />
<div className="flex justify-between mt-1.5 text-[11px] text-[#6b7280]">
<span>Cycle progress</span><span>{Math.round(pct)}%</span>
</div>
</div>
</div>
)}

```
  <div className="grid grid-cols-2 gap-3">
    <StatCard icon={Coins}         label="Total Saved"   value={fmt(totalCollected)} sub="All time"                accent />
    <StatCard icon={Calendar}      label="Days Elapsed"  value={elapsed}             sub={`of ${TOTAL_HANDS} days`} />
    <StatCard icon={TrendingUp}    label="Today's Total" value={fmt(todayTotal)}     sub={`${todayPmts.length} confirmed`} />
    <StatCard icon={AlertTriangle} label="Fines Pool"    value={fmt(totalFines)}     sub={`${Object.keys(defaults).length} defaulter(s)`} />
  </div>

  {/* Expected payout */}
  {collectorHand && (() => {
    const hf = fines[collectorNo] || 0;
    const payout = HANDS.length * DAILY_AMT - hf;
    return (
      <div className="card2 p-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1">Expected Payout Today</p>
          <p className="font-display text-2xl text-white">{fmt(payout)}</p>
          {hf > 0 && <p className="text-[11px] text-red-400 mt-0.5">-{fmt(hf)} fines deducted</p>}
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/10 flex items-center justify-center">
          <Trophy size={22} className="text-[#22c55e]" />
        </div>
      </div>
    );
  })()}

  {/* Top savers */}
  <div className="card p-5">
    <div className="flex items-center gap-2 mb-4">
      <Star size={15} className="text-yellow-400" />
      <h3 className="text-sm font-semibold text-white">Top Savers</h3>
    </div>
    <div className="flex flex-col gap-3">
      {leaderboard.map((h, i) => {
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
        return (
          <div key={h.no} className="flex items-center gap-3">
            <span className="text-lg w-7 text-center select-none">{medals[i]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-white font-medium truncate">{h.name}</p>
                {h.streak > 1 && <span className="text-[11px] text-orange-400 flex items-center gap-0.5"><Flame size={10} />{h.streak}</span>}
              </div>
              <ProgressBar pct={elapsed > 0 ? (h.paidDays / elapsed) * 100 : 0} />
              <p className="text-[10px] text-[#6b7280] mt-0.5">{h.paidDays}/{elapsed} days</p>
            </div>
          </div>
        );
      })}
    </div>
  </div>

  {/* Recent activity */}
  {recentPmts.length > 0 && (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
      <div className="flex flex-col gap-2">
        {recentPmts.map((p, i) => {
          const hand = HANDS.find(h => h.no === p.handNo);
          return (
            <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e1e] last:border-0">
              <div>
                <p className="text-sm text-white font-medium">{hand?.name || `Hand #${p.handNo}`}</p>
                <p className="text-[11px] text-[#6b7280]">{p.date} &middot; {p.note || 'Payment'}</p>
              </div>
              <span className="font-mono text-[#22c55e] text-sm">+{fmt(p.amount)}</span>
            </div>
          );
        })}
      </div>
    </div>
  )}
</div>
```

);
}

// ─── Hands Tab ────────────────────────────────────────────────────────────────
function HandsTab({ payments, order, setOrderRemote, fines, defaults, checkins, isAdmin, onCheckin }) {
const [swapMode, setSwapMode] = useState(false);
const [swapA,    setSwapA]    = useState(null);
const elapsed = daysSince();
const after9  = isAfter9();

useEffect(() => { if (!isAdmin) { setSwapMode(false); setSwapA(null); } }, [isAdmin]);

const paidToday = no => payments.some(p => p.handNo === no && p.date === todayKey());
const checkedIn = no => checkins.some(c => c.handNo === no && c.date === todayKey());
const defaulted = no => after9 && !paidToday(no);

const handleSwap = async (handNo) => {
if (!swapA) { setSwapA(handNo); toast(‘Tap second hand to swap with’, { icon: ‘🔄’ }); }
else if (swapA === handNo) { setSwapA(null); }
else {
const o = […order];
const iA = o.indexOf(swapA), iB = o.indexOf(handNo);
if (iA !== -1 && iB !== -1) { [o[iA], o[iB]] = [o[iB], o[iA]]; await setOrderRemote(o); toast.success(`Swapped positions ${iA + 1} & ${iB + 1}`); }
setSwapA(null); setSwapMode(false);
}
};

return (
<div className="flex flex-col gap-4 animate-fade-in">
<div className="flex items-center justify-between">
<h2 className="font-display text-xl text-white">All Hands <span className="text-[#6b7280] font-sans text-base font-normal">({HANDS.length})</span></h2>
{isAdmin && (
<button onClick={() => { setSwapMode(s => !s); setSwapA(null); }}
className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${swapMode ? 'bg-[#22c55e] text-black' : 'btn-ghost'}`}>
<ArrowRightLeft size={13} />{swapMode ? ‘Cancel’ : ‘Swap Order’}
</button>
)}
</div>

```
  {swapMode && (
    <div className="card2 p-3 flex items-center gap-2">
      <ArrowRightLeft size={13} className="text-[#22c55e] shrink-0" />
      <p className="text-xs text-[#6b7280]">{swapA ? `Selected #${swapA}. Tap hand to swap with.` : 'Tap two hands to swap their payout positions.'}</p>
    </div>
  )}

  <div className="flex flex-col gap-2">
    {order.map((handNo, idx) => {
      const hand      = HANDS.find(h => h.no === handNo);
      if (!hand) return null;
      const paid      = paidToday(handNo);
      const ci        = checkedIn(handNo) && !paid;
      const def       = defaulted(handNo);
      const isToday   = idx === elapsed;
      const isPast    = idx < elapsed;
      const isSelected= swapA === handNo;
      const paidDays  = payments.filter(p => p.handNo === handNo).length;
      const handFines = fines[handNo] || 0;
      const defCnt    = defaults[handNo] || 0;
      const payoutDate= new Date(START_DATE); payoutDate.setDate(payoutDate.getDate() + idx);
      const dateStr   = payoutDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      return (
        <div key={handNo}
          onClick={swapMode ? () => handleSwap(handNo) : undefined}
          className={[
            'card2 p-4 transition-all duration-200',
            swapMode   ? 'cursor-pointer hover:border-[#22c55e]/50' : '',
            isSelected ? '!border-[#22c55e] ring-1 ring-[#22c55e]'  : '',
            isToday    ? '!border-[#22c55e]/40 !bg-[#22c55e]/5'     : '',
          ].join(' ')}
        >
          <div className="flex items-center gap-3">
            <div className={[
              'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-semibold shrink-0',
              isToday ? 'bg-[#22c55e] text-black' : isPast ? 'bg-[#2a2a2a] text-[#6b7280]' : 'bg-[#2a2a2a] text-[#a3a3a3]',
            ].join(' ')}>{idx + 1}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-white font-medium text-sm truncate">{hand.name}</span>
                {isToday   && <Pill variant="green">Today 🎉</Pill>}
                {ci        && <Pill variant="yellow">Pending ✓</Pill>}
                {defCnt>=2 && <Pill variant="red">2x default</Pill>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-[#6b7280]">#{hand.no} &middot; {dateStr} &middot; {paidDays}d paid</span>
                {handFines > 0 && <span className="text-[11px] text-red-400">Fine: {fmt(handFines)}</span>}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1">
              {paid ? (
                <CheckCircle2 size={18} className="text-[#22c55e]" />
              ) : ci ? (
                <div className="w-4 h-4 rounded-full border-2 border-yellow-400 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                </div>
              ) : def ? (
                <>
                  <XCircle size={18} className="text-red-400" />
                  <span className="text-[10px] text-red-400 font-medium">+{fmt(FINE_AMT)}</span>
                </>
              ) : !swapMode ? (
                <button onClick={() => onCheckin(handNo)}
                  className="text-[10px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2 py-1 rounded-lg hover:bg-[#22c55e]/20 transition-colors whitespace-nowrap">
                  I Paid
                </button>
              ) : (
                <div className="w-4 h-4 rounded-full border border-[#3a3a3a]" />
              )}
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>
```

);
}

// ─── Leaderboard Tab ──────────────────────────────────────────────────────────
function LeaderboardTab({ payments, fines, defaults }) {
const elapsed = daysSince();

const getStreak = useCallback((handNo) => {
const dates = payments.filter(p => p.handNo === handNo).map(p => p.date).sort().reverse();
let streak = 0; let cursor = new Date(); cursor.setHours(0, 0, 0, 0);
for (const d of dates) {
const dt = new Date(d); dt.setHours(0, 0, 0, 0);
if (Math.round((cursor - dt) / 86400000) <= 1) { streak++; cursor = dt; } else break;
}
return streak;
}, [payments]);

const ranked = useMemo(() =>
[…HANDS].map(h => {
const paidDays  = payments.filter(p => p.handNo === h.no).length;
const handFines = fines[h.no] || 0;
const defCnt    = defaults[h.no] || 0;
const streak    = getStreak(h.no);
const score     = paidDays * 10 + streak * 5 - defCnt * 15;
return { …h, paidDays, handFines, defCnt, streak, score };
}).sort((a, b) => b.score - a.score),
[payments, fines, defaults, getStreak]
);

const totalPool = Object.values(fines).reduce((s, v) => s + v, 0);
const medals = [‘🥇’, ‘🥈’, ‘🥉’];

return (
<div className="flex flex-col gap-4 animate-fade-in">
<div className="flex items-center justify-between">
<h2 className="font-display text-xl text-white">Leaderboard</h2>
<Pill variant="yellow">Live Rankings</Pill>
</div>

```
  <div className="card2 p-4 flex items-center justify-between">
    <div>
      <p className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1">Fines Pool</p>
      <p className="font-display text-2xl text-white">{fmt(totalPool)}</p>
      <p className="text-[11px] text-[#6b7280] mt-0.5">Rewarded to top weekly saver</p>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
      <Gift size={22} className="text-yellow-400" />
    </div>
  </div>

  <div className="flex flex-col gap-2">
    {ranked.map((h, i) => {
      const pct = elapsed > 0 ? (h.paidDays / elapsed) * 100 : 0;
      return (
        <div key={h.no} className={`card p-4 ${i < 3 ? 'border-[#22c55e]/20' : ''}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none w-8 text-center">{medals[i] || `${i + 1}`}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-white font-medium text-sm">{h.name}</span>
                {h.streak > 1 && <span className="flex items-center gap-0.5 text-[11px] text-orange-400"><Flame size={10} />{h.streak} streak</span>}
                {h.defCnt > 0 && <Pill variant="red">{h.defCnt} default{h.defCnt > 1 ? 's' : ''}</Pill>}
              </div>
              <ProgressBar pct={pct} />
              <div className="flex justify-between mt-1 text-[11px] text-[#6b7280]">
                <span>{h.paidDays}/{elapsed} days</span>
                <span className="font-mono text-[#22c55e]">Score: {h.score}</span>
              </div>
            </div>
            {h.handFines > 0 && <span className="text-[11px] text-red-400 shrink-0">{fmt(h.handFines)}</span>}
          </div>
        </div>
      );
    })}
  </div>
</div>
```

);
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────
function AdminTab({
payments, checkins,
fines, setFinesRemote,
defaults, setDefaultsRemote,
order, setOrderRemote,
isAdmin, setIsAdmin,
adminEnc, setAdminEncRemote,
setGroupEncRemote,
rewardPool, setRewardPoolRemote,
rewardHistory, setRewardHistoryRemote,
}) {
const [showGate,     setShowGate]     = useState(false);
const [form,         setForm]         = useState({ handNo: ‘’, amount: DAILY_AMT, note: ‘’, date: todayKey(), paymentTime: currentTimeStr() });
const [editingId,    setEditingId]    = useState(null);
const [deleteConf,   setDeleteConf]   = useState(null);
const [filterDate,   setFilterDate]   = useState(todayKey());
const [saving,       setSaving]       = useState(false);
const [showAdminPw,  setShowAdminPw]  = useState(false);
const [showGroupPw,  setShowGroupPw]  = useState(false);
const [newPw,        setNewPw]        = useState(’’);
const [showReward,   setShowReward]   = useState(false);
const [rewardHand,   setRewardHand]   = useState(’’);

const handleSubmit = async () => {
if (!form.handNo)                             return toast.error(‘Select a hand’);
if (!form.amount || Number(form.amount) <= 0) return toast.error(‘Enter a valid amount’);
setSaving(true);
try {
if (editingId) {
await updateDoc(doc(db, ‘payments’, editingId), {
handNo: Number(form.handNo), amount: Number(form.amount),
note: form.note || ‘’, date: form.date,
paymentTime: form.paymentTime || currentTimeStr(),
});
toast.success(‘Payment updated’); setEditingId(null);
} else {
const timeStr = form.paymentTime || currentTimeStr();
await addDoc(collection(db, ‘payments’), {
handNo: Number(form.handNo), amount: Number(form.amount),
note: form.note || ‘’, date: form.date, createdAt: serverTimestamp(),
paymentTime: timeStr,
});
const hand = HANDS.find(h => h.no === Number(form.handNo));
const earlyTag = isEarlyPayment(timeStr) ? ’ 🌅 Early!’ : ‘’;
toast.success(`Logged ${fmt(Number(form.amount))} for ${hand?.name}${earlyTag}`);
}
setForm({ handNo: ‘’, amount: DAILY_AMT, note: ‘’, date: todayKey(), paymentTime: currentTimeStr() });
} catch (e) { toast.error(’Save failed: ’ + e.message); }
finally { setSaving(false); }
};

const deletePayment = async id => {
try { await deleteDoc(doc(db, ‘payments’, id)); toast.success(‘Deleted’); setDeleteConf(null); }
catch (e) { toast.error(‘Delete failed’); }
};

const markDefault = async (handNo) => {
if (!handNo) return toast.error(‘Select a hand’);
const updF = { …fines,    [handNo]: (fines[handNo]    || 0) + FINE_AMT };
const updD = { …defaults, [handNo]: (defaults[handNo] || 0) + 1 };
await setFinesRemote(updF); await setDefaultsRemote(updD);
// Add fine to reward pool
await setRewardPoolRemote((rewardPool || 0) + FINE_AMT);
if (updD[handNo] >= 2 && !order.slice(-2).includes(handNo)) {
await setOrderRemote([…order.filter(n => n !== handNo), handNo]);
toast(`Hand moved to end (2 defaults)`, { icon: ‘⚠️’ });
}
toast(`${fmt(FINE_AMT)} fine added for Hand #${handNo}`, { icon: ‘⚠️’ });
};

const disburseReward = async () => {
if (!rewardHand) return toast.error(‘Select winner’);
const pool = Object.values(fines).reduce((s, v) => s + v, 0);
if (pool === 0) return toast.error(‘No fines in pool’);
await setFinesRemote({});
await addDoc(collection(db, ‘payments’), {
handNo: Number(rewardHand), amount: pool,
note: ‘Reward from fines pool’, date: todayKey(), createdAt: serverTimestamp(),
});
toast.success(`${fmt(pool)} reward disbursed!`);
setShowReward(false); setRewardHand(’’);
};

const exportCSV = () => {
const rows = [[‘Date’, ‘Hand No’, ‘Name’, ‘Amount’, ‘Note’]];
[…payments].sort((a, b) => a.date.localeCompare(b.date)).forEach(p => {
const h = HANDS.find(x => x.no === p.handNo);
rows.push([p.date, p.handNo, h?.name || ‘’, p.amount, p.note || ‘’]);
});
const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(’,’)).join(’\n’);
const blob = new Blob([csv], { type: ‘text/csv’ });
const url  = URL.createObjectURL(blob);
const a = document.createElement(‘a’); a.href = url; a.download = ‘ajohub_payments.csv’; a.click();
URL.revokeObjectURL(url); toast.success(‘CSV exported!’);
};

const paymentsByDate = payments.reduce((acc, p) => { (acc[p.date] = acc[p.date] || []).push(p); return acc; }, {});
const sortedDates    = Object.keys(paymentsByDate).sort().reverse();
const pendingCI      = checkins.filter(c => c.date === todayKey() && !payments.some(p => p.handNo === c.handNo && p.date === todayKey()));
const totalPool      = Object.values(fines).reduce((s, v) => s + v, 0);

if (!isAdmin) return (
<div className="flex flex-col items-center justify-center gap-6 py-20 animate-fade-in">
<div className="w-20 h-20 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
<Lock size={32} className="text-[#6b7280]" />
</div>
<div className="text-center">
<h2 className="font-display text-2xl text-white mb-2">Admin Area</h2>
<p className="text-[#6b7280] text-sm">Password required to access admin tools</p>
</div>
<button className=“btn-primary px-8 py-3” onClick={() => setShowGate(true)}>Enter Admin Password</button>
{showGate && <AdminGate adminEnc={adminEnc} onUnlock={() => { setIsAdmin(true); setShowGate(false); toast.success(‘Admin unlocked!’); }} onClose={() => setShowGate(false)} />}
</div>
);

return (
<div className="flex flex-col gap-4 animate-fade-in">
{/* Header */}
<div className="flex items-center justify-between flex-wrap gap-2">
<div className="flex items-center gap-2">
<Unlock size={16} className="text-[#22c55e]" />
<h2 className="font-display text-xl text-white">Admin Panel</h2>
</div>
<div className="flex items-center gap-2 flex-wrap">
<button onClick={() => { setIsAdmin(false); toast(‘Locked’, { icon: ‘🔒’ }); }}
className=“border border-red-500/20 text-red-400 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 hover:border-red-400 transition-colors”>
<Lock size={11} /> Lock
</button>
<button onClick={() => { setShowAdminPw(true); setNewPw(’’); }} className=“btn-ghost text-xs px-3 py-1.5”>Admin PW</button>
<button onClick={() => { setShowGroupPw(true); setNewPw(’’); }} className=“btn-ghost text-xs px-3 py-1.5”>Group PW</button>
<button onClick={exportCSV} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1"><Download size={12} /> CSV</button>
</div>
</div>

```
  {/* Pending check-ins */}
  {pendingCI.length > 0 && (
    <div className="card2 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        <p className="text-sm font-medium text-white">{pendingCI.length} Pending Check-in{pendingCI.length > 1 ? 's' : ''}</p>
      </div>
      <div className="flex flex-col gap-2">
        {pendingCI.map(c => {
          const hand = HANDS.find(h => h.no === c.handNo);
          return (
            <div key={c.id} className="flex items-center justify-between">
              <span className="text-sm text-[#a3a3a3]">{hand?.name || `Hand #${c.handNo}`} — self-reported</span>
              <button onClick={() => setForm(f => ({ ...f, handNo: String(c.handNo) }))}
                className="text-[11px] bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 px-2.5 py-1 rounded-lg hover:bg-[#22c55e]/20 transition-colors">
                Log Now
              </button>
            </div>
          );
        })}
      </div>
    </div>
  )}

  {/* Log form */}
  <div className="card p-5 flex flex-col gap-4">
    <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-widest">{editingId ? 'Edit Payment' : '+ Log Payment'}</h3>
    <div>
      <label className="text-xs text-[#6b7280] mb-1.5 block">Hand</label>
      <select className="input" value={form.handNo} onChange={e => setForm(f => ({ ...f, handNo: e.target.value }))}>
        <option value="">Select hand...</option>
        {order.map(no => { const h = HANDS.find(x => x.no === no); return h ? <option key={no} value={no}>#{no} — {h.name}</option> : null; })}
      </select>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-[#6b7280] mb-1.5 block">Amount (N)</label>
        <input type="number" className="input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
      </div>
      <div>
        <label className="text-xs text-[#6b7280] mb-1.5 block">Date</label>
        <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
      </div>
    </div>
    <div>
      <label className="text-xs text-[#6b7280] mb-1.5 block">
        Payment Time
        <span className="ml-1.5 text-[10px] text-[#4a4a4a] normal-case font-normal">
          {form.paymentTime && isEarlyPayment(form.paymentTime) ? '🌅 Early (+15 pts)' : form.paymentTime && isOnTimePayment(form.paymentTime) ? '✅ On time (+10 pts)' : ''}
        </span>
      </label>
      <input type="time" className="input" value={form.paymentTime} onChange={e => setForm(f => ({ ...f, paymentTime: e.target.value }))} />
    </div>
    <div>
      <label className="text-xs text-[#6b7280] mb-1.5 block">Note (optional)</label>
      <input type="text" className="input" placeholder="e.g. Cash, Transfer..." value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
    </div>
    <div className="flex gap-2">
      <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleSubmit} disabled={saving}>
        {saving && <RefreshCw size={13} className="animate-spin" />}
        {editingId ? 'Update' : 'Log Payment'}
      </button>
      {editingId && <button className="btn-ghost px-4" onClick={() => { setEditingId(null); setForm({ handNo: '', amount: DAILY_AMT, note: '', date: todayKey(), paymentTime: currentTimeStr() }); }}>Cancel</button>}
    </div>
  </div>

  {/* Default + Reward */}
  <div className="grid grid-cols-2 gap-3">
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-widest">Mark Default</h3>
      <select className="input text-xs" id="defSel">
        <option value="">Select...</option>
        {order.map(no => { const h = HANDS.find(x => x.no === no); return h ? <option key={no} value={no}>#{no} {h.name}</option> : null; })}
      </select>
      <button className="bg-red-500/10 text-red-400 border border-red-500/20 py-2 rounded-xl text-xs font-medium hover:bg-red-500/20 transition-colors"
        onClick={() => { const s = document.getElementById('defSel'); if (s.value) markDefault(Number(s.value)); else toast.error('Select a hand'); }}>
        +{fmt(FINE_AMT)} Fine
      </button>
    </div>
    <div className="card p-4 flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-widest">Reward</h3>
      <p className="text-[11px] text-[#6b7280]">Pool: {fmt(totalPool)}</p>
      <button className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-2 rounded-xl text-xs font-medium hover:bg-yellow-500/20 transition-colors"
        onClick={() => setShowReward(true)}>
        Pick Winner
      </button>
    </div>
  </div>

  {/* Fines summary */}
  {Object.keys(fines).length > 0 && (
    <div className="card p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-widest">Fines Summary</h3>
      {Object.entries(fines).map(([no, amt]) => {
        const hand = HANDS.find(h => h.no === Number(no));
        return (
          <div key={no} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{hand?.name || `Hand #${no}`}</p>
              <p className="text-[11px] text-[#6b7280]">{defaults[no] || 0} default(s)</p>
            </div>
            <span className="text-red-400 text-sm font-mono">{fmt(amt)}</span>
          </div>
        );
      })}
    </div>
  )}

  {/* Payment History */}
  <div className="card p-5 flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-widest">Payment History</h3>
      <select className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-[#a3a3a3] focus:outline-none"
        value={filterDate} onChange={e => setFilterDate(e.target.value)}>
        <option value="">All dates</option>
        {sortedDates.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
    {sortedDates.filter(d => !filterDate || d === filterDate).length === 0 && (
      <p className="text-[#6b7280] text-sm text-center py-4">No payments logged yet</p>
    )}
    {sortedDates.filter(d => !filterDate || d === filterDate).map(date => {
      const pmts = paymentsByDate[date] || [];
      return (
        <div key={date}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#6b7280] font-medium">{date}</span>
            <span className="text-xs font-mono text-[#22c55e]">{fmt(pmts.reduce((s, p) => s + p.amount, 0))}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {pmts.map(p => {
              const hand = HANDS.find(h => h.no === p.handNo);
              return (
                <div key={p.id} className="card2 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{hand?.name || `Hand #${p.handNo}`}</p>
                    <p className="text-[11px] text-[#6b7280]">{p.note || 'Payment'} &middot; {fmt(p.amount)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => { setEditingId(p.id); setForm({ handNo: String(p.handNo), amount: p.amount, note: p.note || '', date: p.date, paymentTime: p.paymentTime || currentTimeStr() }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#2a2a2a] transition-colors">
                      <Edit2 size={12} className="text-[#6b7280]" />
                    </button>
                    <button onClick={() => setDeleteConf(p.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 transition-colors">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>

  {/* Modals */}
  <Modal open={!!deleteConf} onClose={() => setDeleteConf(null)} title="Confirm Delete">
    <div className="flex flex-col gap-4">
      <p className="text-[#a3a3a3] text-sm">Delete this payment? This cannot be undone.</p>
      <div className="flex gap-2">
        <button className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-sm font-medium" onClick={() => deletePayment(deleteConf)}>Delete</button>
        <button className="flex-1 btn-ghost" onClick={() => setDeleteConf(null)}>Cancel</button>
      </div>
    </div>
  </Modal>

  <Modal open={showReward} onClose={() => setShowReward(false)} title="Disburse Reward">
    <div className="flex flex-col gap-4">
      <p className="text-[#6b7280] text-sm">Fines pool: <span className="text-white font-semibold">{fmt(totalPool)}</span></p>
      <p className="text-[#6b7280] text-xs">Select the winner. The full pool will be logged as their payment and the fines pool reset.</p>
      <select className="input" value={rewardHand} onChange={e => setRewardHand(e.target.value)}>
        <option value="">Select winner...</option>
        {order.map(no => { const h = HANDS.find(x => x.no === no); return h ? <option key={no} value={no}>#{no} — {h.name}</option> : null; })}
      </select>
      <button className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-2.5 rounded-xl text-sm font-medium hover:bg-yellow-500/20 transition-colors" onClick={disburseReward}>
        Disburse {fmt(totalPool)} Reward
      </button>
    </div>
  </Modal>

  <Modal open={showAdminPw} onClose={() => { setShowAdminPw(false); setNewPw(''); }} title="Change Admin Password">
    <div className="flex flex-col gap-4">
      <p className="text-[#6b7280] text-xs">Protects the admin panel. Min 4 characters.</p>
      <PwInput value={newPw} onChange={setNewPw} placeholder="New admin password" onEnter={async () => {
        if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
        await setAdminEncRemote(encode(newPw));
        setNewPw(''); setShowAdminPw(false); toast.success('Admin password updated');
      }} />
      <button className="btn-primary w-full" onClick={async () => {
        if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
        await setAdminEncRemote(encode(newPw));
        setNewPw(''); setShowAdminPw(false); toast.success('Admin password updated');
      }}>Update Admin Password</button>
    </div>
  </Modal>

  <Modal open={showGroupPw} onClose={() => { setShowGroupPw(false); setNewPw(''); }} title="Change Group Password">
    <div className="flex flex-col gap-4">
      <p className="text-[#6b7280] text-xs">All members use this to open AjoHub. Share the new password after changing. Min 4 characters.</p>
      <PwInput value={newPw} onChange={setNewPw} placeholder="New group password" onEnter={async () => {
        if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
        await setGroupEncRemote(encode(newPw));
        setNewPw(''); setShowGroupPw(false); toast.success('Group password updated — share with all members!');
      }} />
      <button className="btn-primary w-full" onClick={async () => {
        if (!newPw || newPw.length < 4) return toast.error('Min 4 characters');
        await setGroupEncRemote(encode(newPw));
        setNewPw(''); setShowGroupPw(false); toast.success('Group password updated — share with all members!');
      }}>Update Group Password</button>
    </div>
  </Modal>
</div>
```

);
}

// ─── Rewards Tab ──────────────────────────────────────────────────────────────
function RewardsTab({ payments, defaults, fines, rewardPool, rewardHistory, isAdmin, setRewardPoolRemote, setRewardHistoryRemote, setFinesRemote }) {
const [showDisburse, setShowDisburse] = useState(false);
const [disbursing,   setDisbursing]   = useState(false);

// Current week key
const currentWeek = isoWeekKey(todayKey());

// Compute Saver Score per hand for the current week
const weeklyScores = useMemo(() => {
return HANDS.map(h => {
const handPayments = payments.filter(p => p.handNo === h.no && isoWeekKey(p.date) === currentWeek);
const handDefaults = defaults[h.no] || 0;

```
  let score = 0;
  // Points for each payment
  handPayments.forEach(p => {
    const t = p.paymentTime || '08:00';
    if (isEarlyPayment(t))       score += 15; // early (<8am)
    else if (isOnTimePayment(t)) score += 10; // on time (<9pm)
  });
  // Penalties
  score -= handDefaults * 30;
  // Unpaid fines penalty (-10 per ₦500 fine)
  const handFineAmt = fines[h.no] || 0;
  score -= Math.floor(handFineAmt / 500) * 10;

  return { ...h, score, paidThisWeek: handPayments.length, hasDefaults: handDefaults > 0 };
}).sort((a, b) => b.score - a.score);
```

}, [payments, defaults, fines, currentWeek]);

const top5 = weeklyScores.slice(0, 5);
const medals = [‘🥇’, ‘🥈’, ‘🥉’, ‘4️⃣’, ‘5️⃣’];

// Disburse rewards: 70% to 1st, 20% to 2nd, 10% random draw among zero-default hands
const handleDisburse = async () => {
if (rewardPool <= 0) return toast.error(‘Reward pool is empty — carry over to next week’);
setDisbursing(true);
try {
const pool = rewardPool;
const first  = weeklyScores[0];
const second = weeklyScores[1];
// Eligible for random draw: zero defaults
const zeroDefaultHands = weeklyScores.filter(h => !h.hasDefaults);
const randomWinner = zeroDefaultHands.length > 0
? zeroDefaultHands[Math.floor(Math.random() * zeroDefaultHands.length)]
: null;

```
  const share1 = Math.floor(pool * 0.70);
  const share2 = Math.floor(pool * 0.20);
  const share3 = pool - share1 - share2;

  const record = {
    week: currentWeek,
    date: todayKey(),
    pool,
    first:  { handNo: first?.no,  name: first?.name,  amount: share1 },
    second: { handNo: second?.no, name: second?.name, amount: share2 },
    random: randomWinner ? { handNo: randomWinner.no, name: randomWinner.name, amount: share3 } : { handNo: null, name: 'Carried Over', amount: share3 },
  };

  // Reset pool; carry over if no zero-default hands
  await setRewardPoolRemote(randomWinner ? 0 : share3);
  await setRewardHistoryRemote([record, ...rewardHistory].slice(0, 12));
  toast.success(`Rewards disbursed! ${first?.name} gets ${fmt(share1)}`);
  setShowDisburse(false);
} catch (e) { toast.error('Disburse failed: ' + e.message); }
finally { setDisbursing(false); }
```

};

return (
<div className="flex flex-col gap-4 animate-fade-in">
<div className="flex items-center justify-between">
<h2 className="font-display text-xl text-white">Rewards</h2>
<Pill variant="yellow">Week {currentWeek.split(’-W’)[1]}</Pill>
</div>

```
  {/* Reward Pool card */}
  <div className="card p-5 relative overflow-hidden" style={{ borderColor: 'rgba(234,179,8,0.3)' }}>
    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
    <div className="relative flex items-center justify-between">
      <div>
        <p className="text-[10px] text-[#6b7280] uppercase tracking-widest mb-1">Current Reward Pool</p>
        <p className="font-display text-3xl text-white">{fmt(rewardPool)}</p>
        <p className="text-[11px] text-[#6b7280] mt-1">₦500 per fine &middot; Disbursed Saturdays by 10pm</p>
      </div>
      <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center shrink-0">
        <Gift size={26} className="text-yellow-400" />
      </div>
    </div>
    {/* Breakdown */}
    <div className="mt-4 grid grid-cols-3 gap-2">
      {[['🥇 1st', '70%'], ['🥈 2nd', '20%'], ['🎲 Draw', '10%']].map(([label, pct]) => (
        <div key={label} className="bg-[#1a1a1a] rounded-xl p-2.5 text-center">
          <p className="text-xs text-white font-medium">{pct}</p>
          <p className="text-[10px] text-[#6b7280] mt-0.5">{label}</p>
        </div>
      ))}
    </div>
    <p className="text-[10px] text-[#4a4a4a] mt-2.5">🎲 Draw = random hand with zero defaults this week</p>
  </div>

  {/* Scoring guide */}
  <div className="card2 p-4">
    <p className="text-xs text-[#a3a3a3] font-semibold uppercase tracking-widest mb-3">How Points Work</p>
    <div className="grid grid-cols-2 gap-2 text-[11px]">
      <div className="flex items-center gap-2"><span className="text-green-400">+15</span><span className="text-[#6b7280]">Early payment (before 8am)</span></div>
      <div className="flex items-center gap-2"><span className="text-green-400">+10</span><span className="text-[#6b7280]">On-time payment (before 9pm)</span></div>
      <div className="flex items-center gap-2"><span className="text-red-400">−30</span><span className="text-[#6b7280]">Default (missed day)</span></div>
      <div className="flex items-center gap-2"><span className="text-red-400">−10</span><span className="text-[#6b7280]">Per unpaid fine (₦500)</span></div>
    </div>
  </div>

  {/* Weekly leaderboard */}
  <div className="card p-5 flex flex-col gap-3">
    <div className="flex items-center gap-2 mb-1">
      <Star size={14} className="text-yellow-400" />
      <h3 className="text-sm font-semibold text-white">Weekly Saver Score — Top 5</h3>
    </div>
    {top5.map((h, i) => (
      <div key={h.no} className={`flex items-center gap-3 py-2 ${i < top5.length - 1 ? 'border-b border-[#1e1e1e]' : ''}`}>
        <span className="text-xl w-7 text-center select-none">{medals[i]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{h.name}</p>
          <p className="text-[10px] text-[#6b7280]">{h.paidThisWeek} payment{h.paidThisWeek !== 1 ? 's' : ''} this week{h.hasDefaults ? ' · has defaults' : ' · zero defaults ✓'}</p>
        </div>
        <span className={`font-mono text-sm font-semibold shrink-0 ${h.score >= 0 ? 'text-[#22c55e]' : 'text-red-400'}`}>{h.score > 0 ? '+' : ''}{h.score}</span>
      </div>
    ))}
  </div>

  {/* Admin disburse button */}
  {isAdmin && (
    <button
      className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-3 rounded-2xl text-sm font-medium hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-2"
      onClick={() => setShowDisburse(true)}>
      <Gift size={15} /> Disburse Weekly Reward
    </button>
  )}

  {/* Past disbursements */}
  {rewardHistory.length > 0 && (
    <div className="card p-5 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[#a3a3a3] uppercase tracking-widest">Past Disbursements</h3>
      {rewardHistory.map((r, i) => (
        <div key={i} className="border-b border-[#1e1e1e] last:border-0 pb-3 last:pb-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#6b7280] font-medium">Week {r.week?.split('-W')[1]} &middot; {r.date}</span>
            <span className="text-xs font-mono text-yellow-400">{fmt(r.pool)}</span>
          </div>
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="text-[#a3a3a3]">🥇 {r.first?.name} — {fmt(r.first?.amount)}</span>
            <span className="text-[#a3a3a3]">🥈 {r.second?.name} — {fmt(r.second?.amount)}</span>
            <span className="text-[#a3a3a3]">🎲 {r.random?.name} — {fmt(r.random?.amount)}</span>
          </div>
        </div>
      ))}
    </div>
  )}

  {/* Disburse Modal */}
  <Modal open={showDisburse} onClose={() => setShowDisburse(false)} title="Disburse Weekly Reward">
    <div className="flex flex-col gap-4">
      <p className="text-[#6b7280] text-sm">Pool: <span className="text-white font-semibold">{fmt(rewardPool)}</span></p>
      {rewardPool <= 0
        ? <p className="text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5">Pool is empty this week. Carry over continues automatically.</p>
        : (
          <>
            <div className="flex flex-col gap-2 text-[11px] text-[#6b7280] bg-[#1a1a1a] rounded-xl p-3">
              <p>🥇 <span className="text-white">{weeklyScores[0]?.name}</span> — {fmt(Math.floor(rewardPool * 0.7))} (70%)</p>
              <p>🥈 <span className="text-white">{weeklyScores[1]?.name}</span> — {fmt(Math.floor(rewardPool * 0.2))} (20%)</p>
              <p>🎲 Random zero-default hand — {fmt(rewardPool - Math.floor(rewardPool * 0.7) - Math.floor(rewardPool * 0.2))} (10%)</p>
            </div>
            <p className="text-[10px] text-[#4a4a4a]">Ties split equally. If no zero-default hands, the 10% carries to next week.</p>
            <button
              className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 py-2.5 rounded-xl text-sm font-medium hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-2"
              onClick={handleDisburse} disabled={disbursing}>
              {disbursing && <RefreshCw size={13} className="animate-spin" />}
              Confirm Disburse
            </button>
          </>
        )
      }
    </div>
  </Modal>
</div>
```

);
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
const [tab,         setTab]         = useState(‘dashboard’);
const [isAdmin,     setIsAdmin]     = useState(false);
const [loading,     setLoading]     = useState(true);
const [online,      setOnline]      = useState(navigator.onLine);
const [groupAccess, setGroupAccess] = useState(() => sessionStorage.getItem(‘ajohub_access’) === ‘1’);

const [payments,  setPayments]  = useState([]);
const [checkins,  setCheckins]  = useState([]);
const [order,     setOrder]     = useState(DEFAULT_ORDER);
const [fines,     setFines]     = useState({});
const [defaults,  setDefaults]  = useState({});
const [adminEnc,  setAdminEnc]  = useState(DEFAULT_ADMIN_ENC);
const [groupEnc,  setGroupEnc]  = useState(DEFAULT_GROUP_ENC);
const [rewardPool,    setRewardPool]    = useState(0);
const [rewardHistory, setRewardHistory] = useState([]);

useEffect(() => {
const on = () => setOnline(true), off = () => setOnline(false);
window.addEventListener(‘online’, on); window.addEventListener(‘offline’, off);
return () => { window.removeEventListener(‘online’, on); window.removeEventListener(‘offline’, off); };
}, []);

// Real-time: payments
useEffect(() => {
const timeout = setTimeout(() => setLoading(false), 6000);
const q = query(collection(db, ‘payments’), orderBy(‘createdAt’, ‘asc’));
const unsub = onSnapshot(q, snap => {
clearTimeout(timeout);
setPayments(snap.docs.map(d => ({ id: d.id, …d.data() })));
setLoading(false);
}, err => {
clearTimeout(timeout);
console.error(err);
if (err.code === ‘permission-denied’) toast.error(‘Firebase permission denied — check Firestore rules’);
else toast.error(’Connection error: ’ + err.message);
setLoading(false);
});
return () => { clearTimeout(timeout); unsub(); };
}, []);

// Real-time: checkins
useEffect(() => {
const unsub = onSnapshot(collection(db, ‘checkins’), snap => {
setCheckins(snap.docs.map(d => ({ id: d.id, …d.data() })));
}, err => console.error(‘Checkins:’, err));
return () => unsub();
}, []);

// Real-time: settings — seeds defaults on first run
useEffect(() => {
const unsub = onSnapshot(collection(db, ‘settings’), snap => {
snap.docs.forEach(d => {
const v = d.data().value;
if (d.id === ‘payout_order’) setOrder(v);
if (d.id === ‘fines’)        setFines(v);
if (d.id === ‘defaults’)     setDefaults(v);
if (d.id === ‘admin_enc’)    setAdminEnc(v);
if (d.id === ‘group_enc’)    setGroupEnc(v);
if (d.id === ‘reward_pool’)  setRewardPool(v || 0);
if (d.id === ‘reward_history’) setRewardHistory(v || []);
});
if (snap.empty) {
fbSet(‘payout_order’, DEFAULT_ORDER);
fbSet(‘fines’,        {});
fbSet(‘defaults’,     {});
fbSet(‘admin_enc’,    DEFAULT_ADMIN_ENC);
fbSet(‘group_enc’,    DEFAULT_GROUP_ENC);
fbSet(‘reward_pool’,  0);
fbSet(‘reward_history’, []);
}
}, err => console.error(‘Settings:’, err));
return () => unsub();
}, []);

const setOrderRemote    = useCallback(v => fbSet(‘payout_order’, v), []);
const setFinesRemote    = useCallback(v => fbSet(‘fines’, v),        []);
const setDefaultsRemote = useCallback(v => fbSet(‘defaults’, v),     []);
const setAdminEncRemote = useCallback(v => fbSet(‘admin_enc’, v),    []);
const setGroupEncRemote = useCallback(v => fbSet(‘group_enc’, v),    []);
const setRewardPoolRemote    = useCallback(v => fbSet(‘reward_pool’, v),    []);
const setRewardHistoryRemote = useCallback(v => fbSet(‘reward_history’, v), []);

const handleCheckin = async (handNo) => {
const already = checkins.some(c => c.handNo === handNo && c.date === todayKey());
const paid    = payments.some(p => p.handNo === handNo && p.date === todayKey());
if (already || paid) return toast(‘Already marked for today’, { icon: ‘ℹ️’ });
await addDoc(collection(db, ‘checkins’), { handNo, date: todayKey(), createdAt: serverTimestamp() });
toast.success(‘Check-in recorded! Admin will confirm your payment.’);
};

const tabs = [
{ id: ‘dashboard’,   label: ‘Home’,     icon: LayoutDashboard },
{ id: ‘hands’,       label: ‘Hands’,    icon: Users           },
{ id: ‘leaderboard’, label: ‘Rankings’, icon: Trophy          },
{ id: ‘rewards’,     label: ‘Rewards’,  icon: Gift            },
{ id: ‘admin’,       label: ‘Admin’,    icon: Shield          },
];

if (!groupAccess) {
return <GroupGate groupEnc={groupEnc} onUnlock={() => setGroupAccess(true)} />;
}

return (
<div className="min-h-dvh bg-[#0a0a0a] font-body">
<Toaster position=“top-center” toastOptions={{
style: { background: ‘#1e1e1e’, color: ‘#f5f5f5’, border: ‘1px solid #2a2a2a’, borderRadius: ‘12px’, fontSize: ‘13px’ },
success: { iconTheme: { primary: ‘#22c55e’, secondary: ‘#0a0a0a’ } },
}} />

```
  <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#1a1a1a]">
    <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
      <div>
        <h1 className="font-display text-xl text-white leading-none">AjoHub</h1>
        <p className="text-[10px] text-[#6b7280] mt-0.5 font-mono">
          Day {daysSince() + 1} &middot; {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && (
          <div className="flex items-center gap-1.5 bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-1 rounded-lg">
            <Unlock size={11} className="text-[#22c55e]" />
            <span className="text-[10px] text-[#22c55e] font-medium">Admin</span>
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${!online ? 'bg-red-500/10' : ''}`}>
          {online
            ? <><div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" /><span className="text-xs text-[#6b7280]">Live</span></>
            : <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-400">Offline</span></>
          }
        </div>
      </div>
    </div>
  </header>

  <main className="max-w-lg mx-auto px-4 py-5 pb-28">
    {loading ? <Spinner label="Connecting to AjoHub..." /> : (
      <>
        {tab === 'dashboard'   && <Dashboard    payments={payments} order={order} fines={fines} defaults={defaults} checkins={checkins} />}
        {tab === 'hands'       && <HandsTab     payments={payments} order={order} setOrderRemote={setOrderRemote} fines={fines} defaults={defaults} checkins={checkins} isAdmin={isAdmin} onCheckin={handleCheckin} />}
        {tab === 'leaderboard' && <LeaderboardTab payments={payments} fines={fines} defaults={defaults} />}
        {tab === 'rewards'     && <RewardsTab   payments={payments} defaults={defaults} rewardPool={rewardPool} rewardHistory={rewardHistory} isAdmin={isAdmin} setRewardPoolRemote={setRewardPoolRemote} setRewardHistoryRemote={setRewardHistoryRemote} setFinesRemote={setFinesRemote} fines={fines} />}
        {tab === 'admin'       && (
          <AdminTab
            payments={payments}     checkins={checkins}
            fines={fines}           setFinesRemote={setFinesRemote}
            defaults={defaults}     setDefaultsRemote={setDefaultsRemote}
            order={order}           setOrderRemote={setOrderRemote}
            isAdmin={isAdmin}       setIsAdmin={setIsAdmin}
            adminEnc={adminEnc}     setAdminEncRemote={setAdminEncRemote}
            setGroupEncRemote={setGroupEncRemote}
            rewardPool={rewardPool} setRewardPoolRemote={setRewardPoolRemote}
            rewardHistory={rewardHistory} setRewardHistoryRemote={setRewardHistoryRemote}
          />
        )}
      </>
    )}
  </main>

  <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-[#1a1a1a]">
    <div className="max-w-lg mx-auto px-2 py-2 flex items-center justify-around">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all duration-150 flex-1 ${active ? 'text-[#22c55e]' : 'text-[#4a4a4a] hover:text-[#6b7280]'}`}>
            <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
            <span className={`text-[10px] font-medium ${active ? 'text-[#22c55e]' : ''}`}>{label}</span>
          </button>
        );
      })}
    </div>
  </nav>
</div>
```

);
}
